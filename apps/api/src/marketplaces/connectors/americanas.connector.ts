import { Injectable } from '@nestjs/common';
import { Marketplace } from '@prisma/client';
import { BaseConnector } from './base.connector';
import {
  ConnectorContext,
  ConnectorResult,
  NormalizedOrder,
} from './connector.interface';

/** Status Skyhub → status unificado do hub. */
const SKYHUB_STATUS_MAP: Record<string, string> = {
  NEW: 'PENDING',
  APPROVED: 'PAID',
  INVOICED: 'PROCESSING',
  SHIPPED: 'SHIPPED',
  DELIVERED: 'DELIVERED',
  CANCELED: 'CANCELLED',
  SHIPMENT_EXCEPTION: 'SHIPPED',
};

/**
 * Conector Americanas Marketplace (plataforma Skyhub/B2W).
 * Docs: https://developers.skyhub.com.br
 *
 * Autenticação por headers estáticos, salvos nas credenciais da conta:
 *   ctx.credentials: { user_email, api_key, account_manager_key }
 */
@Injectable()
export class AmericanasConnector extends BaseConnector {
  readonly marketplace: Marketplace = 'AMERICANAS';
  private readonly baseUrl = 'https://api.skyhub.com.br';

  private headers(ctx: ConnectorContext) {
    const email = ctx.credentials?.user_email as string | undefined;
    const apiKey = ctx.credentials?.api_key as string | undefined;
    const managerKey = ctx.credentials?.account_manager_key as string | undefined;
    if (!email || !apiKey) return null;
    return {
      'X-User-Email': email,
      'X-Api-Key': apiKey,
      ...(managerKey ? { 'X-Accountmanager-Key': managerKey } : {}),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  override async fetchOrders(
    since: Date,
    ctx: ConnectorContext,
  ): Promise<ConnectorResult<NormalizedOrder[]>> {
    const headers = this.headers(ctx);
    if (!headers) {
      return {
        ok: false,
        error:
          'Conta Americanas não conectada: informe user_email e api_key nas credenciais.',
      };
    }

    try {
      const url =
        `${this.baseUrl}/orders?per_page=50` +
        `&filters[start_date]=${encodeURIComponent(since.toISOString())}`;
      const res = await fetch(url, { headers });
      if (!res.ok) {
        return { ok: false, error: `Skyhub ${res.status}: ${await res.text()}` };
      }
      const data = (await res.json()) as {
        orders?: Array<{
          code: string;
          status: { type?: string; code?: string };
          placed_at: string;
          total_ordered: number;
          shipping_cost?: number;
          customer?: { name?: string };
          items: Array<{
            id: string;
            name: string;
            qty: number;
            special_price?: number;
            original_price?: number;
          }>;
        }>;
      };

      const orders: NormalizedOrder[] = (data.orders ?? []).map((o) => {
        const itemsTotal = o.items.reduce(
          (sum, it) => sum + (it.special_price ?? it.original_price ?? 0) * it.qty,
          0,
        );
        return {
          externalOrderId: o.code,
          status:
            SKYHUB_STATUS_MAP[o.status?.type ?? o.status?.code ?? ''] ?? 'PENDING',
          placedAt: new Date(o.placed_at),
          buyerName: o.customer?.name,
          itemsTotal,
          shippingTotal: o.shipping_cost ?? 0,
          grandTotal: o.total_ordered,
          items: o.items.map((it) => ({
            sku: it.id,
            title: it.name,
            quantity: it.qty,
            unitPrice: it.special_price ?? it.original_price ?? 0,
          })),
        };
      });

      return { ok: true, data: orders };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }

  /** Informa envio (com rastreio) ou entrega ao Skyhub. */
  override async updateOrderStatus(
    externalOrderId: string,
    status: string,
    trackingCode: string | undefined,
    ctx: ConnectorContext,
  ): Promise<ConnectorResult> {
    const headers = this.headers(ctx);
    if (!headers) return { ok: false, error: 'Conta Americanas não conectada' };

    try {
      if (status === 'SHIPPED') {
        const res = await fetch(
          `${this.baseUrl}/orders/${externalOrderId}/shipments`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify({
              shipment: {
                code: trackingCode ?? externalOrderId,
                track: {
                  code: trackingCode ?? '',
                  carrier: 'CORREIOS',
                },
              },
            }),
          },
        );
        if (!res.ok) {
          return { ok: false, error: `Skyhub ${res.status}: ${await res.text()}` };
        }
        return { ok: true };
      }

      if (status === 'DELIVERED') {
        const res = await fetch(
          `${this.baseUrl}/orders/${externalOrderId}/delivery`,
          { method: 'POST', headers },
        );
        if (!res.ok) {
          return { ok: false, error: `Skyhub ${res.status}: ${await res.text()}` };
        }
        return { ok: true };
      }

      return { ok: true, data: { skipped: `status ${status} não é enviado ao Skyhub` } };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }

  override async updateStock(
    externalListingId: string,
    quantity: number,
    ctx: ConnectorContext,
  ): Promise<ConnectorResult> {
    const headers = this.headers(ctx);
    if (!headers) return { ok: false, error: 'Conta Americanas não conectada' };

    try {
      // No Skyhub o estoque é atualizado pelo SKU do produto.
      const res = await fetch(`${this.baseUrl}/products/${externalListingId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ product: { qty: quantity } }),
      });
      if (!res.ok) {
        return { ok: false, error: `Skyhub ${res.status}: ${await res.text()}` };
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }
}
