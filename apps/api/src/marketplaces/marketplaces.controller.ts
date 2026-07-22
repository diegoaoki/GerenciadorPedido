import { Body, Controller, Get, Header, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MarketplacesService } from './marketplaces.service';
import { MercadoLivreOAuthService } from './mercado-livre-oauth.service';
import { CreateAccountDto } from './dto/create-account.dto';

@ApiTags('marketplaces')
@Controller('marketplaces')
export class MarketplacesController {
  constructor(
    private readonly marketplaces: MarketplacesService,
    private readonly mlOAuth: MercadoLivreOAuthService,
  ) {}

  /** URL de autorização para conectar uma conta do Mercado Livre. */
  @Get('mercado-livre/connect/:accountId')
  mlConnect(@Param('accountId') accountId: string) {
    return this.mlOAuth.connectUrl(accountId);
  }

  /** Retorno do OAuth do ML (redirect_uri). Mostra uma página simples. */
  @Get('mercado-livre/callback')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async mlCallback(@Query('code') code: string, @Query('state') state: string) {
    try {
      const result = await this.mlOAuth.handleCallback(code, state);
      return `<html><body style="font-family:sans-serif;text-align:center;padding-top:4rem">
        <h2>✅ Conta do Mercado Livre conectada!</h2>
        <p>Seller ID: ${result.sellerId}</p>
        <p>Pode fechar esta janela e voltar ao painel.</p>
      </body></html>`;
    } catch (e) {
      return `<html><body style="font-family:sans-serif;text-align:center;padding-top:4rem">
        <h2>❌ Falha ao conectar</h2><p>${(e as Error).message}</p>
      </body></html>`;
    }
  }

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
