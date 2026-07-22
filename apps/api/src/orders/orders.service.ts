import { Injectable, NotFoundException } from '@nestjs/common';
import { Marketplace, OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

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
    return this.prisma.order.update({
      where: { id },
      data: { status, ...(trackingCode ? { trackingCode } : {}) },
    });
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
