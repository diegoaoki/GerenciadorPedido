import { Module } from '@nestjs/common';
import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';
import { MarketplacesModule } from '../marketplaces/marketplaces.module';

@Module({
  imports: [MarketplacesModule],
  controllers: [ListingsController],
  providers: [ListingsService],
})
export class ListingsModule {}
