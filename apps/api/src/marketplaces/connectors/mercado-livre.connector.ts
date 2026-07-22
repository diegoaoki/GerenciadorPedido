import { Injectable } from '@nestjs/common';
import { Marketplace } from '@prisma/client';
import { BaseConnector } from './base.connector';
import {
  ConnectorContext,
  ConnectorResult,
} from './connector.interface';

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

  // publishListing e fetchOrders do ML exigem mapear categorias, atributos
  // obrigatórios e o recurso /orders/search — próximos passos quando as
  // credenciais estiverem configuradas. Herdam o comportamento da base.
}
