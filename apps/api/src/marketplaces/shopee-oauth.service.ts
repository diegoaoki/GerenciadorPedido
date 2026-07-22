import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHmac } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Autorização de loja da Shopee (Open Platform v2).
 *
 * 1. connectUrl(accountId) → URL /shop/auth_partner (lojista aprova)
 * 2. handleCallback(code, shopId, accountId) → troca por access/refresh token
 * 3. ensureFreshToken(accountId) → renova quando expira (tokens duram 4h)
 */
@Injectable()
export class ShopeeOAuthService {
  private readonly logger = new Logger(ShopeeOAuthService.name);
  private readonly baseUrl = 'https://partner.shopeemobile.com';

  constructor(private readonly prisma: PrismaService) {}

  private config() {
    const partnerId = process.env.SHOPEE_PARTNER_ID;
    const partnerKey = process.env.SHOPEE_PARTNER_KEY;
    const redirectUri =
      process.env.SHOPEE_REDIRECT_URI ??
      'https://integracao-api-six.vercel.app/api/marketplaces/shopee/callback';
    if (!partnerId || !partnerKey) {
      throw new ServiceUnavailableException(
        'Shopee não configurada: defina SHOPEE_PARTNER_ID e SHOPEE_PARTNER_KEY (crie o app em open.shopee.com).',
      );
    }
    return { partnerId: Number(partnerId), partnerKey, redirectUri };
  }

  /** Assinatura de chamadas públicas (sem access_token). */
  private publicSign(path: string, timestamp: number, partnerId: number, partnerKey: string) {
    return createHmac('sha256', partnerKey)
      .update(`${partnerId}${path}${timestamp}`)
      .digest('hex');
  }

  async connectUrl(accountId: string) {
    const account = await this.prisma.marketplaceAccount.findUnique({
      where: { id: accountId },
    });
    if (!account || account.marketplace !== 'SHOPEE') {
      throw new NotFoundException('Conta Shopee não encontrada');
    }
    const { partnerId, partnerKey, redirectUri } = this.config();
    const path = '/api/v2/shop/auth_partner';
    const timestamp = Math.floor(Date.now() / 1000);
    const sign = this.publicSign(path, timestamp, partnerId, partnerKey);
    // accountId vai como sufixo do redirect para sabermos qual conta conectar.
    const redirect = encodeURIComponent(`${redirectUri}?accountId=${accountId}`);
    const url =
      `${this.baseUrl}${path}?partner_id=${partnerId}&timestamp=${timestamp}` +
      `&sign=${sign}&redirect=${redirect}`;
    return { url };
  }

  async handleCallback(code: string, shopId: string, accountId: string) {
    if (!code || !shopId || !accountId) {
      throw new BadRequestException('Parâmetros code/shop_id/accountId ausentes');
    }
    const { partnerId, partnerKey } = this.config();
    const path = '/api/v2/auth/token/get';
    const timestamp = Math.floor(Date.now() / 1000);
    const sign = this.publicSign(path, timestamp, partnerId, partnerKey);

    const res = await fetch(
      `${this.baseUrl}${path}?partner_id=${partnerId}&timestamp=${timestamp}&sign=${sign}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, shop_id: Number(shopId), partner_id: partnerId }),
      },
    );
    const data = (await res.json()) as {
      error?: string;
      message?: string;
      access_token?: string;
      refresh_token?: string;
      expire_in?: number;
    };
    if (data.error || !data.access_token) {
      throw new BadRequestException(
        `Falha ao obter token Shopee: ${data.error} ${data.message ?? ''}`,
      );
    }

    await this.saveTokens(accountId, Number(shopId), data);
    this.logger.log(`Conta Shopee ${accountId} conectada (shop ${shopId})`);
    return { connected: true, shopId: Number(shopId) };
  }

  private async saveTokens(
    accountId: string,
    shopId: number,
    tokens: { access_token?: string; refresh_token?: string; expire_in?: number },
  ) {
    const credentials = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      shop_id: shopId,
      expires_at: Date.now() + ((tokens.expire_in ?? 14400) - 300) * 1000,
    };
    await this.prisma.marketplaceAccount.update({
      where: { id: accountId },
      data: { credentials: credentials as Prisma.InputJsonValue },
    });
    return credentials;
  }

  async ensureFreshToken(accountId: string): Promise<Record<string, unknown>> {
    const account = await this.prisma.marketplaceAccount.findUnique({
      where: { id: accountId },
    });
    if (!account) throw new NotFoundException(`Conta ${accountId} não encontrada`);

    const creds = (account.credentials as Record<string, unknown>) ?? {};
    if (!creds.refresh_token) {
      throw new BadRequestException(
        'Conta Shopee ainda não conectada. Use o botão Conectar.',
      );
    }
    if (typeof creds.expires_at === 'number' && Date.now() < creds.expires_at) {
      return creds;
    }

    const { partnerId, partnerKey } = this.config();
    const path = '/api/v2/auth/access_token/get';
    const timestamp = Math.floor(Date.now() / 1000);
    const sign = this.publicSign(path, timestamp, partnerId, partnerKey);

    const res = await fetch(
      `${this.baseUrl}${path}?partner_id=${partnerId}&timestamp=${timestamp}&sign=${sign}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refresh_token: creds.refresh_token,
          shop_id: creds.shop_id,
          partner_id: partnerId,
        }),
      },
    );
    const data = (await res.json()) as {
      error?: string;
      access_token?: string;
      refresh_token?: string;
      expire_in?: number;
    };
    if (data.error || !data.access_token) {
      throw new BadRequestException(`Falha ao renovar token Shopee: ${data.error}`);
    }
    this.logger.log(`Token Shopee renovado para conta ${accountId}`);
    return this.saveTokens(accountId, Number(creds.shop_id), data);
  }
}
