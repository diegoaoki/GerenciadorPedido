import { Injectable } from '@nestjs/common';
import { Marketplace } from '@prisma/client';
import { BaseConnector } from './base.connector';
import {
  ConnectorContext,
  ConnectorResult,
  NormalizedOrder,
} from './connector.interface';

/** Status do ML → status unificado do hub. */
const ML_STATUS_MAP: Record<string, string> = {
  confirmed: 'PENDING',
  payment_required: 'PENDING',
  payment_in_process: 'PENDING',
  paid: 'PAID',
  shipped: 'SHIPPED',
  delivered: 'DELIVERED',
  cancelled: 'CANCELLED',
};

/**
 * Conector do Mercado Livre.
 * Docs: https://developers.mercadolivre.com.br
 *
 * A API do ML usa OAuth2. O access_token vive em ctx.credentials.access_token
 * (renovado via refresh_token — ver MarketplacesService.refreshToken quando
 * implementarmos o fluxo OAuth completo).
 */
@Injectable()
export class MercadoLivreConnector extends BaseConnector {
  readonly marketplace: Marketplace = 'MERCADO_LIVRE';
  private readonly baseUrl = 'https://api.mercadolibre.com';

  private token(ctx: ConnectorContext): string | undefined {
    return ctx.credentials?.access_token as string | undefined;
  }

  override async updateStock(
    externalListingId: string,
    quantity: number,
    ctx: ConnectorContext,
  ): Promise<ConnectorResult> {
    const token = this.token(ctx);
    if (!token) return { ok: false, error: 'Sem access_token do Mercado Livre' };

    try {
      // PUT /items/{id} { available_quantity }
      const res = await fetch(`${this.baseUrl}/items/${externalListingId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ available_quantity: quantity }),
      });
      if (!res.ok) {
        return { ok: false, error: `ML ${res.status}: ${await res.text()}` };
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }

  override async updatePrice(
    externalListingId: string,
    price: number,
    ctx: ConnectorContext,
  ): Promise<ConnectorResult> {
    const token = this.token(ctx);
    if (!token) return { ok: false, error: 'Sem access_token do Mercado Livre' };

    try {
      const res = await fetch(`${this.baseUrl}/items/${externalListingId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ price }),
      });
      if (!res.ok) {
        return { ok: false, error: `ML ${res.status}: ${await res.text()}` };
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }

  /** Busca pedidos do vendedor desde `since`, já normalizados. */
  override async fetchOrders(
    since: Date,
    ctx: ConnectorContext,
  ): Promise<ConnectorResult<NormalizedOrder[]>> {
    const token = this.token(ctx);
    const sellerId = ctx.credentials?.user_id;
    if (!token || !sellerId)
      return { ok: false, error: 'Conta do Mercado Livre não conectada (sem token/seller)' };

    try {
      const url =
        `${this.baseUrl}/orders/search?seller=${sellerId}` +
        `&order.date_created.from=${encodeURIComponent(since.toISOString())}` +
        `&sort=date_desc&limit=50`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        return { ok: false, error: `ML ${res.status}: ${await res.text()}` };
      }

      const data = (await res.json()) as {
        results: Array<{
          id: number;
          status: string;
          date_created: string;
          total_amount: number;
          paid_amount: number;
          buyer?: { nickname?: string; first_name?: string; last_name?: string };
          order_items: Array<{
            item: { title: string; seller_sku?: string; id: string };
            quantity: number;
            unit_price: number;
          }>;
          shipping?: { id?: number };
        }>;
      };

      const orders: NormalizedOrder[] = (data.results ?? []).map((o) => {
        const itemsTotal = o.order_items.reduce(
          (sum, it) => sum + it.unit_price * it.quantity,
          0,
        );
        return {
          externalOrderId: String(o.id),
          status: ML_STATUS_MAP[o.status] ?? 'PENDING',
          placedAt: new Date(o.date_created),
          buyerName:
            [o.buyer?.first_name, o.buyer?.last_name].filter(Boolean).join(' ') ||
            o.buyer?.nickname,
          itemsTotal,
          shippingTotal: Math.max(0, (o.paid_amount ?? itemsTotal) - itemsTotal),
          grandTotal: o.paid_amount ?? o.total_amount ?? itemsTotal,
          items: o.order_items.map((it) => ({
            sku: it.item.seller_sku ?? it.item.id,
            title: it.item.title,
            quantity: it.quantity,
            unitPrice: it.unit_price,
          })),
        };
      });

      return { ok: true, data: orders };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }

  /**
   * Informa envio ao ML (pedidos com logística própria/custom).
   * Nota: pedidos com Mercado Envios (ME2) têm o status gerenciado pelo
   * próprio ML — nesses casos a chamada é ignorada pelo marketplace.
   * Validar o fluxo completo quando as credenciais forem ativadas.
   */
  override async updateOrderStatus(
    externalOrderId: string,
    status: string,
    trackingCode: string | undefined,
    ctx: ConnectorContext,
  ): Promise<ConnectorResult> {
    if (status !== 'SHIPPED') {
      return { ok: true, data: { skipped: `status ${status} não é enviado ao ML` } };
    }
    const token = this.token(ctx);
    if (!token) return { ok: false, error: 'Sem access_token do Mercado Livre' };

    try {
      // 1. Descobre o shipment do pedido
      const orderRes = await fetch(`${this.baseUrl}/orders/${externalOrderId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!orderRes.ok) {
        return { ok: false, error: `ML ${orderRes.status}: ${await orderRes.text()}` };
      }
      const order = (await orderRes.json()) as {
        shipping?: { id?: number };
      };
      const shipmentId = order.shipping?.id;
      if (!shipmentId) {
        return { ok: false, error: 'Pedido sem shipment associado no ML' };
      }

      // 2. Atualiza o shipment (logística custom) com rastreio
      const res = await fetch(`${this.baseUrl}/shipments/${shipmentId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'shipped',
          ...(trackingCode ? { tracking_number: trackingCode } : {}),
        }),
      });
      if (!res.ok) {
        return { ok: false, error: `ML shipments ${res.status}: ${await res.text()}` };
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }

  // publishListing do ML exige mapear categorias e atributos obrigatórios —
  // próximo passo quando as credenciais estiverem configuradas.
}
