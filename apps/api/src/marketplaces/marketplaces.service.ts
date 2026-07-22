import { Injectable, NotFoundException } from '@nestjs/common';
import { Marketplace, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ConnectorRegistry } from './connectors/connector.registry';
import { ConnectorContext } from './connectors/connector.interface';
import { availableForSale } from '../common/fulfillment';

@Injectable()
export class MarketplacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: ConnectorRegistry,
  ) {}

  supported() {
    return this.registry.supported();
  }

  // ---- Contas -------------------------------------------------------

  createAccount(input: {
    marketplace: Marketplace;
    nickname: string;
    credentials?: Record<string, unknown>;
  }) {
    return this.prisma.marketplaceAccount.create({
      data: {
        marketplace: input.marketplace,
        nickname: input.nickname,
        credentials: (input.credentials ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  listAccounts() {
    return this.prisma.marketplaceAccount.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { listings: true, orders: true } } },
    });
  }

  private async accountContext(accountId: string): Promise<ConnectorContext> {
    const account = await this.prisma.marketplaceAccount.findUnique({
      where: { id: accountId },
    });
    if (!account) throw new NotFoundException(`Conta ${accountId} não encontrada`);
    return {
      accountId,
      credentials: (account.credentials as Record<string, unknown>) ?? {},
    };
  }

  // ---- Sincronização de estoque ------------------------------------

  /**
   * Empurra o estoque disponível de uma variação para TODOS os seus
   * anúncios ativos, em cada marketplace. Retorna o resultado por canal.
   */
  async syncStockForVariant(variantId: string) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      include: {
        inventory: true,
        product: true,
        listings: { include: { account: true } },
      },
    });

    if (!variant) throw new NotFoundException(`Variação ${variantId} não encontrada`);

    const available = availableForSale(
      variant.product.fulfillmentType,
      variant.inventory,
    );

    const results = [];
    for (const listing of variant.listings) {
      if (!listing.externalListingId || listing.status !== 'ACTIVE') continue;

      const connector = this.registry.get(listing.marketplace);
      const ctx: ConnectorContext = {
        accountId: listing.accountId,
        credentials:
          (listing.account.credentials as Record<string, unknown>) ?? {},
      };

      const result = await connector.updateStock(
        listing.externalListingId,
        available,
        ctx,
      );

      await this.prisma.listing.update({
        where: { id: listing.id },
        data: {
          lastSyncedAt: new Date(),
          lastError: result.ok ? null : result.error,
          status: result.ok ? 'ACTIVE' : 'ERROR',
        },
      });

      results.push({
        listingId: listing.id,
        marketplace: listing.marketplace,
        ...result,
      });
    }
    return { variantId, available, results };
  }

  // ---- Importação de pedidos ---------------------------------------

  /**
   * Busca pedidos de uma conta desde `since` e os grava no formato
   * unificado (idempotente por marketplace+externalOrderId).
   */
  async importOrders(accountId: string, since: Date) {
    const account = await this.prisma.marketplaceAccount.findUnique({
      where: { id: accountId },
    });
    if (!account) throw new NotFoundException(`Conta ${accountId} não encontrada`);

    const connector = this.registry.get(account.marketplace);
    const ctx = await this.accountContext(accountId);
    const result = await connector.fetchOrders(since, ctx);
    if (!result.ok) return { imported: 0, error: result.error };

    let imported = 0;
    for (const o of result.data ?? []) {
      await this.prisma.order.upsert({
        where: {
          marketplace_externalOrderId: {
            marketplace: account.marketplace,
            externalOrderId: o.externalOrderId,
          },
        },
        create: {
          accountId,
          marketplace: account.marketplace,
          externalOrderId: o.externalOrderId,
          status: 'PENDING',
          buyerName: o.buyerName,
          buyerEmail: o.buyerEmail,
          buyerDoc: o.buyerDoc,
          itemsTotal: new Prisma.Decimal(o.itemsTotal),
          shippingTotal: new Prisma.Decimal(o.shippingTotal),
          grandTotal: new Prisma.Decimal(o.grandTotal),
          shippingAddress: (o.shippingAddress ?? {}) as Prisma.InputJsonValue,
          trackingCode: o.trackingCode,
          placedAt: o.placedAt,
          items: {
            create: o.items.map((it) => ({
              sku: it.sku,
              title: it.title,
              quantity: it.quantity,
              unitPrice: new Prisma.Decimal(it.unitPrice),
            })),
          },
        },
        update: { trackingCode: o.trackingCode },
      });
      imported++;
    }
    return { imported };
  }
}
