import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Fluxo OAuth2 do Mercado Livre.
 *
 * 1. connectUrl(accountId)  → URL de autorização (usuário loga e aprova)
 * 2. handleCallback(code, state) → troca o code por tokens e salva na conta
 * 3. ensureFreshToken(accountId) → renova via refresh_token quando expirar
 *
 * Docs: https://developers.mercadolivre.com.br/pt_br/autenticacao-e-autorizacao
 */
@Injectable()
export class MercadoLivreOAuthService {
  private readonly logger = new Logger(MercadoLivreOAuthService.name);
  private readonly authBase = 'https://auth.mercadolivre.com.br';
  private readonly apiBase = 'https://api.mercadolibre.com';

  constructor(private readonly prisma: PrismaService) {}

  private config() {
    const clientId = process.env.ML_CLIENT_ID;
    const clientSecret = process.env.ML_CLIENT_SECRET;
    const redirectUri =
      process.env.ML_REDIRECT_URI ??
      'http://localhost:3333/api/marketplaces/mercado-livre/callback';
    if (!clientId || !clientSecret) {
      throw new ServiceUnavailableException(
        'Mercado Livre não configurado: defina ML_CLIENT_ID e ML_CLIENT_SECRET em apps/api/.env (crie o app em developers.mercadolivre.com.br).',
      );
    }
    return { clientId, clientSecret, redirectUri };
  }

  /** URL para o usuário autorizar o app na conta dele do ML. */
  async connectUrl(accountId: string) {
    const account = await this.prisma.marketplaceAccount.findUnique({
      where: { id: accountId },
    });
    if (!account || account.marketplace !== 'MERCADO_LIVRE') {
      throw new NotFoundException('Conta de Mercado Livre não encontrada');
    }
    const { clientId, redirectUri } = this.config();
    // accountId vai no `state` para sabermos qual conta conectar no retorno.
    const url =
      `${this.authBase}/authorization?response_type=code` +
      `&client_id=${clientId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=${accountId}`;
    return { url };
  }

  /** Troca o authorization code por tokens e salva na conta. */
  async handleCallback(code: string, state: string) {
    if (!code || !state)
      throw new BadRequestException('Parâmetros code/state ausentes');

    const { clientId, clientSecret, redirectUri } = this.config();

    const res = await fetch(`${this.apiBase}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });
    if (!res.ok) {
      throw new BadRequestException(
        `Falha ao trocar code por token no ML: ${res.status} ${await res.text()}`,
      );
    }
    const tokens = (await res.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      user_id: number;
    };

    await this.saveTokens(state, tokens);
    this.logger.log(`Conta ML ${state} conectada (seller ${tokens.user_id})`);
    return { connected: true, sellerId: tokens.user_id };
  }

  private async saveTokens(
    accountId: string,
    tokens: {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      user_id: number;
    },
  ) {
    const credentials = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      user_id: tokens.user_id,
      // margem de 5 min antes do vencimento real
      expires_at: Date.now() + (tokens.expires_in - 300) * 1000,
    };
    await this.prisma.marketplaceAccount.update({
      where: { id: accountId },
      data: { credentials: credentials as Prisma.InputJsonValue },
    });
    return credentials;
  }

  /**
   * Garante um access_token válido para a conta, renovando via
   * refresh_token se necessário. Retorna as credenciais atualizadas.
   */
  async ensureFreshToken(accountId: string): Promise<Record<string, unknown>> {
    const account = await this.prisma.marketplaceAccount.findUnique({
      where: { id: accountId },
    });
    if (!account) throw new NotFoundException(`Conta ${accountId} não encontrada`);

    const creds = (account.credentials as Record<string, unknown>) ?? {};
    if (!creds.refresh_token) {
      throw new BadRequestException(
        'Conta do Mercado Livre ainda não conectada (sem tokens). Use o botão Conectar.',
      );
    }

    // Ainda válido?
    if (typeof creds.expires_at === 'number' && Date.now() < creds.expires_at) {
      return creds;
    }

    // Renovar
    const { clientId, clientSecret } = this.config();
    const res = await fetch(`${this.apiBase}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: String(creds.refresh_token),
      }),
    });
    if (!res.ok) {
      throw new BadRequestException(
        `Falha ao renovar token do ML (reconecte a conta): ${res.status}`,
      );
    }
    const tokens = (await res.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      user_id: number;
    };
    this.logger.log(`Token ML renovado para conta ${accountId}`);
    return this.saveTokens(accountId, tokens);
  }
}
