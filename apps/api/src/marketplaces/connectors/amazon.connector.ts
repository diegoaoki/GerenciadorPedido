import { Injectable } from '@nestjs/common';
import { Marketplace } from '@prisma/client';
import { BaseConnector } from './base.connector';

/**
 * Conector da Amazon (Selling Partner API).
 * Docs: https://developer-docs.amazon.com/sp-api
 *
 * A SP-API usa LWA (Login with Amazon) para tokens e trabalha com "feeds"
 * assíncronos para estoque/preço (submete um documento e consulta o status).
 * Esse fluxo de feeds entra aqui na implementação real.
 */
@Injectable()
export class AmazonConnector extends BaseConnector {
  readonly marketplace: Marketplace = 'AMAZON';
  // private readonly baseUrl = 'https://sellingpartnerapi-na.amazon.com';
}
