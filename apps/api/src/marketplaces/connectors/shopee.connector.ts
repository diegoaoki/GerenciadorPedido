import { Injectable } from '@nestjs/common';
import { Marketplace } from '@prisma/client';
import { createHmac } from 'crypto';
import { BaseConnector } from './base.connector';
import {
  ConnectorContext,
  ConnectorResult,
  NormalizedOrder,
} from './connector.interface';

/** Status Shopee → status unificado do hub. */
const SHOPEE_STATUS_MAP: Record<string, string> = {
  UNPAID: 'PENDING',
  READY_TO_SHIP: 'PAID',
  PROCESSED: 'PROCESSING',
  SHIPPED: 'SHIPPED',
  TO_CONFIRM_RECEIVE: 'SHIPPED',
  COMPLETED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
  TO_RETURN: 'RETURNED',
};

/**
 * Conector da Shopee (Open Platform v2).
 * Docs: https://open.shopee.com/documents
 *
 * Toda chamada é assinada com HMAC-SHA256 usando a partner_key:
 *   sign = HMAC(partner_key, partner_id + path + timestamp [+ access_token + shop_id])
 *
 * Credenciais por conta (ctx.credentials): access_token, refresh_token,
 * shop_id. Partner (app) via env: SHOPEE_PARTNER_ID / SHOPEE_PARTNER_KEY.
 */
@Injectable()
export class ShopeeConnector extends BaseConnector {
  readonly marketplace: Marketplace = 'SHOPEE';
  private readonly baseUrl = 'https://partner.shopeemobile.com';

  private partner() {
    const id = process.env.SHOPEE_PARTNER_ID;
    const key = process.env.SHOPEE_PARTNER_KEY;
    if (!id || !key) return null;
    return { id: Number(id), key };
  }

  /** Assinatura de chamadas de loja (com access_token + shop_id). */
  private sign(path: string, timestamp: number, accessToken: string, shopId: number, key: string, partnerId: number) {
    const base = `${partnerId}${path}${timestamp}${accessToken}${shopId}`;
    return createHmac('sha256', key).update(base).digest('hex');
  }

  private shopParams(ctx: ConnectorContext, path: string) {
    const partner = this.partner();
    if (!partner) return { error: 'Shopee não configurada: defina SHOPEE_PARTNER_ID/KEY no env' };

    const accessToken = ctx.credentials?.access_token as string | undefined;
    const shopId = ctx.credentials?.shop_id as number | undefined;
    if (!accessToken || !shopId) return { error: 'Conta Shopee não conectada (sem access_token/shop_id)' };

    const timestamp = Math.floor(Date.now() / 1000);
    const sign = this.sign(path, timestamp, accessToken, shopId, partner.key, partner.id);
    return {
      query: `partner_id=${partner.id}&timestamp=${timestamp}&access_token=${accessToken}&shop_id=${shopId}&sign=${sign}`,
    };
  }

  override async fetchOrders(
    since: Date,
    ctx: ConnectorContext,
  ): Promise<ConnectorResult<NormalizedOrder[]>> {
    const listPath = '/api/v2/order/get_order_list';
    const params = this.shopParams(ctx, listPath);
    if ('error' in params) return { ok: false, error: params.error };

    try {
      // 1. Lista os order_sn do período
      const timeFrom = Math.floor(since.getTime() / 1000);
      const timeTo = Math.floor(Date.now() / 1000);
      const listUrl =
        `${this.baseUrl}${listPath}?${params.query}` +
        `&time_range_field=create_time&time_from=${timeFrom}&time_to=${timeTo}&page_size=50`;
      const listRes = await fetch(listUrl);
      const listData = (await listRes.json()) as {
        error?: string;
        message?: string;
        response?: { order_list?: Array<{ order_sn: string }> };
      };
      if (listData.error) {
        return { ok: false, error: `Shopee: ${listData.error} ${listData.message ?? ''}` };
      }
      const orderSns = (listData.response?.order_list ?? []).map((o) => o.order_sn);
      if (orderSns.length === 0) return { ok: true, data: [] };

      // 2. Busca os detalhes
      const detailPath = '/api/v2/order/get_order_detail';
      const detailParams = this.shopParams(ctx, detailPath);
      if ('error' in detailParams) return { ok: false, error: detailParams.error };

      const detailUrl =
        `${this.baseUrl}${detailPath}?${detailParams.query}` +
        `&order_sn_list=${orderSns.join(',')}` +
        `&response_optional_fields=buyer_username,recipient_address,item_list,total_amount,actual_shipping_fee`;
      const detailRes = await fetch(detailUrl);
      const detailData = (await detailRes.json()) as {
        error?: string;
        response?: {
          order_list?: Array<{
            order_sn: string;
            order_status: string;
            create_time: number;
            total_amount: number;
            actual_shipping_fee?: number;
            buyer_username?: string;
            item_list: Array<{
              item_name: string;
              model_sku?: string;
              item_sku?: string;
              model_quantity_purchased: number;
              model_discounted_price: number;
            }>;
          }>;
        };
      };
      if (detailData.error) return { ok: false, error: `Shopee: ${detailData.error}` };

      const orders: NormalizedOrder[] = (detailData.response?.order_list ?? []).map((o) => {
        const itemsTotal = o.item_list.reduce(
          (sum, it) => sum + it.model_discounted_price * it.model_quantity_purchased,
          0,
        );
        return {
          externalOrderId: o.order_sn,
          status: SHOPEE_STATUS_MAP[o.order_status] ?? 'PENDING',
          placedAt: new Date(o.create_time * 1000),
          buyerName: o.buyer_username,
          itemsTotal,
          shippingTotal: o.actual_shipping_fee ?? 0,
          grandTotal: o.total_amount,
          items: o.item_list.map((it) => ({
            sku: it.model_sku || it.item_sku || 'SEM-SKU',
            title: it.item_name,
            quantity: it.model_quantity_purchased,
            unitPrice: it.model_discounted_price,
          })),
        };
      });

      return { ok: true, data: orders };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }

  /** Marca o pedido como enviado na Shopee (dropoff com rastreio). */
  override async updateOrderStatus(
    externalOrderId: string,
    status: string,
    trackingCode: string | undefined,
    ctx: ConnectorContext,
  ): Promise<ConnectorResult> {
    if (status !== 'SHIPPED') {
      return { ok: true, data: { skipped: `status ${status} não é enviado à Shopee` } };
    }
    const path = '/api/v2/logistics/ship_order';
    const params = this.shopParams(ctx, path);
    if ('error' in params) return { ok: false, error: params.error };

    try {
      const res = await fetch(`${this.baseUrl}${path}?${params.query}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_sn: externalOrderId,
          dropoff: trackingCode ? { tracking_no: trackingCode } : {},
        }),
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (data.error) {
        return { ok: false, error: `Shopee: ${data.error} ${data.message ?? ''}` };
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }

  override async updateStock(
    externalListingId: string,
    quantity: number,
    ctx: ConnectorContext,
  ): Promise<ConnectorResult> {
    const path = '/api/v2/product/update_stock';
    const params = this.shopParams(ctx, path);
    if ('error' in params) return { ok: false, error: params.error };

    try {
      const res = await fetch(`${this.baseUrl}${path}?${params.query}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: Number(externalListingId),
          stock_list: [{ model_id: 0, seller_stock: [{ stock: quantity }] }],
        }),
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (data.error) return { ok: false, error: `Shopee: ${data.error} ${data.message ?? ''}` };
      return { ok: true };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }
}
