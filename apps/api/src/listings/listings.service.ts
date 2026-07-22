import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ConnectorRegistry } from '../marketplaces/connectors/connector.registry';
import { availableForSale } from '../common/fulfillment';

@Injectable()
export class ListingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: ConnectorRegistry,
  ) {}

  list() {
    return this.prisma.listing.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        variant: { include: { product: true } },
        account: true,
      },
    });
  }

  /** Cria o anúncio no hub (status DRAFT) ligando variação ↔ conta. */
  async create(input: { variantId: string; accountId: string; price?: number }) {
    const account = await this.prisma.marketplaceAccount.findUnique({
      where: { id: input.accountId },
    });
    if (!account) throw new NotFoundException('Conta de marketplace não encontrada');

    return this.prisma.listing.create({
      data: {
        variantId: input.variantId,
        accountId: input.accountId,
        marketplace: account.marketplace,
        price: input.price != null ? new Prisma.Decimal(input.price) : null,
      },
    });
  }

  /** Publica o anúncio no marketplace via conector. */
  async publish(listingId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      include: {
        account: true,
        variant: {
          include: {
            product: {
              include: {
                images: true,
                options: { include: { choices: true } },
                channelDescriptions: true,
              },
            },
            inventory: true,
          },
        },
      },
    });
    if (!listing) throw new NotFoundException('Anúncio não encontrado');

    const connector = this.registry.get(listing.marketplace);
    const { variant } = listing;
    const { product } = variant;
    const price = Number(listing.price ?? variant.basePrice);
    const available = availableForSale(product.fulfillmentType, variant.inventory);

    await this.prisma.listing.update({
      where: { id: listingId },
      data: { status: 'PUBLISHING' },
    });

    const result = await connector.publishListing({
      ctx: {
        accountId: listing.accountId,
        credentials: (listing.account.credentials as Record<string, unknown>) ?? {},
      },
      title: product.title,
      // Descrição do canal, se cadastrada; senão a descrição base.
      description:
        product.channelDescriptions.find(
          (d) => d.marketplace === listing.marketplace,
        )?.description ??
        product.description ??
        undefined,
      sku: variant.sku,
      price,
      quantity: Math.max(0, available),
      handlingDays: product.productionDays,
      images: product.images.map((i) => i.url),
      attributes: variant.attributes as Record<string, unknown>,
      options: product.options.map((o) => ({
        name: o.name,
        type: o.type,
        required: o.required,
        choices: o.choices.map((c) => ({
          label: c.label,
          priceModifier: Number(c.priceModifier),
        })),
      })),
    });

    return this.prisma.listing.update({
      where: { id: listingId },
      data: result.ok
        ? {
            status: 'ACTIVE',
            externalListingId: result.data?.externalListingId,
            lastSyncedAt: new Date(),
            lastError: null,
          }
        : { status: 'ERROR', lastError: result.error },
    });
  }
}
