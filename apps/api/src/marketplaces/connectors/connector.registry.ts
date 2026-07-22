import { Injectable, NotFoundException } from '@nestjs/common';
import { Marketplace } from '@prisma/client';
import { MarketplaceConnector } from './connector.interface';
import { MercadoLivreConnector } from './mercado-livre.connector';
import { ShopeeConnector } from './shopee.connector';
import { AmazonConnector } from './amazon.connector';
import { MagaluConnector } from './magalu.connector';
import { AmericanasConnector } from './americanas.connector';

/**
 * Localiza o conector certo para um marketplace. É o único lugar que
 * conhece todos os conectores — o resto do sistema pede por enum.
 */
@Injectable()
export class ConnectorRegistry {
  private readonly connectors: Map<Marketplace, MarketplaceConnector>;

  constructor(
    ml: MercadoLivreConnector,
    shopee: ShopeeConnector,
    amazon: AmazonConnector,
    magalu: MagaluConnector,
    americanas: AmericanasConnector,
  ) {
    this.connectors = new Map(
      [ml, shopee, amazon, magalu, americanas].map((c) => [c.marketplace, c]),
    );
  }

  get(marketplace: Marketplace): MarketplaceConnector {
    const connector = this.connectors.get(marketplace);
    if (!connector)
      throw new NotFoundException(
        `Nenhum conector registrado para ${marketplace}`,
      );
    return connector;
  }

  supported(): Marketplace[] {
    return [...this.connectors.keys()];
  }
}
