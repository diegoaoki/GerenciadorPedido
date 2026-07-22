import { Injectable } from '@nestjs/common';
import { Marketplace } from '@prisma/client';
import { BaseConnector } from './base.connector';

/**
 * Conector da Shopee.
 * Docs: https://open.shopee.com/documents
 *
 * A Shopee usa assinatura HMAC-SHA256 (partner_id + partner_key + timestamp)
 * em cada request, além de access_token por loja. A assinatura entra aqui
 * quando implementarmos as chamadas reais.
 */
@Injectable()
export class ShopeeConnector extends BaseConnector {
  readonly marketplace: Marketplace = 'SHOPEE';
  // private readonly baseUrl = 'https://partner.shopeemobile.com';
}
