import { Injectable } from '@nestjs/common';
import { Marketplace } from '@prisma/client';
import { BaseConnector } from './base.connector';

/**
 * Conector Magalu (Marketplace do Magazine Luiza).
 * Portal: https://developers.magalu.com
 *
 * Observação: "Americanas" (ex-B2W / Skyhub) é um marketplace separado com
 * outra API — modelado no enum como AMERICANAS. Podemos criar um
 * AmericanasConnector no mesmo padrão quando for a vez dele.
 */
@Injectable()
export class MagaluConnector extends BaseConnector {
  readonly marketplace: Marketplace = 'MAGALU';
}
