import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MarketplacesService } from './marketplaces.service';
import { CreateAccountDto } from './dto/create-account.dto';

@ApiTags('marketplaces')
@Controller('marketplaces')
export class MarketplacesController {
  constructor(private readonly marketplaces: MarketplacesService) {}

  @Get('supported')
  supported() {
    return this.marketplaces.supported();
  }

  @Get('accounts')
  listAccounts() {
    return this.marketplaces.listAccounts();
  }

  @Post('accounts')
  createAccount(@Body() dto: CreateAccountDto) {
    return this.marketplaces.createAccount(dto);
  }

  @Post('sync/stock/:variantId')
  syncStock(@Param('variantId') variantId: string) {
    return this.marketplaces.syncStockForVariant(variantId);
  }

  @Post('accounts/:accountId/import-orders')
  importOrders(
    @Param('accountId') accountId: string,
    @Query('since') since?: string,
  ) {
    const sinceDate = since
      ? new Date(since)
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // últimos 7 dias
    return this.marketplaces.importOrders(accountId, sinceDate);
  }
}
