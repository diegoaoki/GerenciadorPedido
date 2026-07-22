import { Module } from '@nestjs/common';
import { MarketplacesController } from './marketplaces.controller';
import { SyncController } from './sync.controller';
import { MarketplacesService } from './marketplaces.service';
import { MercadoLivreOAuthService } from './mercado-livre-oauth.service';
import { ShopeeOAuthService } from './shopee-oauth.service';
import { ConnectorRegistry } from './connectors/connector.registry';
import { MercadoLivreConnector } from './connectors/mercado-livre.connector';
import { ShopeeConnector } from './connectors/shopee.connector';
import { AmazonConnector } from './connectors/amazon.connector';
import { MagaluConnector } from './connectors/magalu.connector';
import { AmericanasConnector } from './connectors/americanas.connector';

@Module({
  controllers: [MarketplacesController, SyncController],
  providers: [
    MarketplacesService,
    MercadoLivreOAuthService,
    ShopeeOAuthService,
    ConnectorRegistry,
    MercadoLivreConnector,
    ShopeeConnector,
    AmazonConnector,
    MagaluConnector,
    AmericanasConnector,
  ],
  exports: [MarketplacesService, ConnectorRegistry],
})
export class MarketplacesModule {}
