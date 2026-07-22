import { Injectable } from '@nestjs/common';
import { Marketplace } from '@prisma/client';
import { BaseConnector } from './base.connector';
import {
  ConnectorContext,
  ConnectorResult,
  NormalizedOrder,
} from './connector.interface';

/**
 * Conector Magalu (Magazine Luiza Marketplace).
 * Portal: https://developers.magalu.com — OAuth2 (id.magalu.com).
 *
 * Estrutura pronta para credenciais: quando o usuário tiver o app aprovado
 * no portal do Magalu, preencher MAGALU_CLIENT_ID/SECRET no env e completar
 * os endpoints conforme a documentação da conta (os caminhos exatos variam
 * entre a API nova e a legada IntegraCommerce — confirmar na aprovação).
 *
 * ctx.credentials esperado: { access_token, refresh_token, expires_at }
 */
@Injectable()
export class MagaluConnector extends BaseConnector {
  readonly marketplace: Marketplace = 'MAGALU';

  override async fetchOrders(
    _since: Date,
    ctx: ConnectorContext,
  ): Promise<ConnectorResult<NormalizedOrder[]>> {
    if (!ctx.credentials?.access_token) {
      return {
        ok: false,
        error:
          'Conta Magalu não conectada. Crie o app em developers.magalu.com e configure MAGALU_CLIENT_ID/SECRET.',
      };
    }
    // Endpoints definitivos entram quando as credenciais forem emitidas —
    // a doc completa só fica visível com o app aprovado no portal.
    return this.notImplemented<NormalizedOrder[]>(
      'fetchOrders (aguardando credenciais Magalu)',
    );
  }
}
