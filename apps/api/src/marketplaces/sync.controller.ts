import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Logger,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { MarketplacesService } from './marketplaces.service';
import { Public } from '../auth/public.decorator';

/**
 * Entradas automáticas de sincronização:
 *
 * - POST /webhooks/mercado-livre — o ML notifica em tempo real quando um
 *   pedido é criado/atualizado (configurar a URL no app do ML).
 * - GET /cron/import-orders — varredura de segurança agendada (Vercel Cron),
 *   protegida por CRON_SECRET.
 */
@ApiTags('sync')
@Controller()
export class SyncController {
  private readonly logger = new Logger(SyncController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly marketplaces: MarketplacesService,
  ) {}

  /** Notificações do Mercado Livre (tempo real). */
  @Public()
  @Post('webhooks/mercado-livre')
  @HttpCode(200)
  async mlWebhook(
    @Body() body: { topic?: string; resource?: string; user_id?: number },
  ) {
    // Só nos interessam eventos de pedidos.
    if (!body?.topic?.includes('orders')) return { ignored: true };

    // Localiza a conta pelo seller (user_id) salvo no OAuth.
    const accounts = await this.prisma.marketplaceAccount.findMany({
      where: { marketplace: 'MERCADO_LIVRE', active: true },
    });
    const account = accounts.find(
      (a) =>
        (a.credentials as Record<string, unknown>)?.user_id === body.user_id,
    );
    if (!account) {
      this.logger.warn(`Webhook ML para seller desconhecido: ${body.user_id}`);
      return { ignored: true };
    }

    // Import idempotente dos últimos dias cobre o pedido notificado.
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const result = await this.marketplaces.importOrders(account.id, since);
    this.logger.log(
      `Webhook ML (${body.topic}): ${result.imported} pedido(s) sincronizado(s)`,
    );
    return { ok: true, ...result };
  }

  /** Varredura agendada (Vercel Cron) — todas as contas conectadas. */
  @Public()
  @Get('cron/import-orders')
  async cronImport(@Headers('authorization') authHeader?: string) {
    const secret = process.env.CRON_SECRET;
    if (!secret || authHeader !== `Bearer ${secret}`) {
      throw new UnauthorizedException('CRON_SECRET inválido');
    }

    const accounts = await this.prisma.marketplaceAccount.findMany({
      where: { active: true },
    });

    const since = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const results = [];
    for (const account of accounts) {
      // Só tenta contas com credenciais (conectadas).
      const creds = (account.credentials as Record<string, unknown>) ?? {};
      if (!creds.refresh_token && !creds.access_token) continue;

      try {
        const r = await this.marketplaces.importOrders(account.id, since);
        results.push({ account: account.nickname, ...r });
      } catch (e) {
        results.push({ account: account.nickname, error: (e as Error).message });
      }
    }

    this.logger.log(`Cron de importação: ${JSON.stringify(results)}`);
    return { ran: true, results };
  }
}
