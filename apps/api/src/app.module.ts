import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { CatalogModule } from './catalog/catalog.module';
import { InventoryModule } from './inventory/inventory.module';
import { ListingsModule } from './listings/listings.module';
import { OrdersModule } from './orders/orders.module';
import { MarketplacesModule } from './marketplaces/marketplaces.module';
import { AiModule } from './ai/ai.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    CatalogModule,
    InventoryModule,
    ListingsModule,
    OrdersModule,
    MarketplacesModule,
    AiModule,
  ],
})
export class AppModule {}
