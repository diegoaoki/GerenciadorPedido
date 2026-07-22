import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Marketplace, OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MarketplacesService } from '../marketplaces/marketplaces.service';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly marketplaces: MarketplacesService,
  ) {}

  async list(params: {
    status?: OrderStatus;
    marketplace?: Marketplace;
    skip?: number;
    take?: number;
  }) {
    const { status, marketplace, skip = 0, take = 50 } = params;
    const where: Prisma.OrderWhereInput = {
      ...(status ? { status } : {}),
      ...(marketplace ? { marketplace } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        skip,
        take,
        orderBy: { placedAt: 'desc' },
        include: { items: true, account: true },
      }),
      this.prisma.order.count({ where }),
    ]);
    return { items, total, skip, take };
  }

  async get(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            variant: { include: { product: true } },
            options: true,
          },
        },
        account: true,
      },
    });
    if (!order) throw new NotFoundException(`Pedido ${id} não encontrado`);
    return order;
  }

  async updateStatus(id: string, status: OrderStatus, trackingCode?: string) {
    await this.get(id);
    const order = await this.prisma.order.update({
      where: { id },
      data: { status, ...(trackingCode ? { trackingCode } : {}) },
    });

    // Empurra a mudança para o marketplace de origem (não bloqueia o hub
    // se o marketplace falhar — o resultado volta como aviso).
    let marketplaceSync: { ok: boolean; error?: string } = { ok: true };
    if (status === 'SHIPPED' || status === 'DELIVERED') {
      try {
        marketplaceSync = await this.marketplaces.pushOrderStatus(
          id,
          status,
          trackingCode,
        );
      } catch (e) {
        marketplaceSync = { ok: false, error: (e as Error).message };
      }
      if (!marketplaceSync.ok) {
        this.logger.warn(
          `Pedido ${order.externalOrderId}: status local atualizado, mas o marketplace respondeu: ${marketplaceSync.error}`,
        );
      }
    }

    return { ...order, marketplaceSync };
  }

  /** KPIs para o topo do painel. */
  async summary() {
    const [byStatus, revenueAgg, todayCount] = await this.prisma.$transaction([
      this.prisma.order.groupBy({
        by: ['status'],
        _count: true,
        orderBy: { status: 'asc' },
      }),
      this.prisma.order.aggregate({
        _sum: { grandTotal: true },
        where: { status: { in: ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'] } },
      }),
      this.prisma.order.count({
        where: {
          placedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
    ]);
    return {
      byStatus,
      revenue: revenueAgg._sum.grandTotal ?? 0,
      today: todayCount,
    };
  }
}
