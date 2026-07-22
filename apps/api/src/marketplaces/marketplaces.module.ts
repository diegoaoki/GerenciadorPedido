import { Module } from '@nestjs/common';
import { MarketplacesController } from './marketplaces.controller';
import { MarketplacesService } from './marketplaces.service';
import { ConnectorRegistry } from './connectors/connector.registry';
import { MercadoLivreConnector } from './connectors/mercado-livre.connector';
import { ShopeeConnector } from './connectors/shopee.connector';
import { AmazonConnector } from './connectors/amazon.connector';
import { MagaluConnector } from './connectors/magalu.connector';

@Module({
  controllers: [MarketplacesController],
  providers: [
    MarketplacesService,
    ConnectorRegistry,
    MercadoLivreConnector,
    ShopeeConnector,
    AmazonConnector,
    MagaluConnector,
  ],
  exports: [MarketplacesService, ConnectorRegistry],
})
export class MarketplacesModule {}
