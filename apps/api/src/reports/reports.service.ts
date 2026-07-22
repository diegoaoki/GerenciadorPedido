import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const REVENUE_STATUSES = ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'] as const;

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Consolidado de vendas dos últimos `days` dias (pedidos pagos+). */
  async summary(days: number) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));

    const orders = await this.prisma.order.findMany({
      where: {
        placedAt: { gte: start },
        status: { in: [...REVENUE_STATUSES] },
      },
      include: {
        items: { include: { variant: true } },
      },
      orderBy: { placedAt: 'asc' },
    });

    // ---- Totais -----------------------------------------------------
    const revenue = orders.reduce((s, o) => s + Number(o.grandTotal), 0);
    const orderCount = orders.length;
    const avgTicket = orderCount > 0 ? revenue / orderCount : 0;

    // ---- Custo/margem (via costPrice; fallback: SKU do item) --------
    const missingSkus = new Set<string>();
    for (const o of orders)
      for (const it of o.items)
        if (!it.variant && it.sku) missingSkus.add(it.sku);

    const skuVariants = missingSkus.size
      ? await this.prisma.productVariant.findMany({
          where: { sku: { in: [...missingSkus] } },
          select: { sku: true, costPrice: true },
        })
      : [];
    const costBySku = new Map(skuVariants.map((v) => [v.sku, v.costPrice]));

    let cost = 0;
    let costCoveredItems = 0;
    let totalItems = 0;
    for (const o of orders) {
      for (const it of o.items) {
        totalItems += it.quantity;
        const costPrice = it.variant?.costPrice ?? costBySku.get(it.sku) ?? null;
        if (costPrice != null) {
          cost += Number(costPrice) * it.quantity;
          costCoveredItems += it.quantity;
        }
      }
    }
    const margin = revenue - cost;
    const marginPct = revenue > 0 ? (margin / revenue) * 100 : 0;

    // ---- Por dia (preenche dias sem venda com zero) -------------------
    const byDayMap = new Map<string, { revenue: number; orders: number }>();
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      byDayMap.set(d.toISOString().slice(0, 10), { revenue: 0, orders: 0 });
    }
    for (const o of orders) {
      const key = o.placedAt.toISOString().slice(0, 10);
      const entry = byDayMap.get(key);
      if (entry) {
        entry.revenue += Number(o.grandTotal);
        entry.orders += 1;
      }
    }
    const byDay = [...byDayMap.entries()].map(([date, v]) => ({ date, ...v }));

    // ---- Por marketplace ---------------------------------------------
    const byMarketplaceMap = new Map<string, { orders: number; revenue: number }>();
    for (const o of orders) {
      const entry = byMarketplaceMap.get(o.marketplace) ?? { orders: 0, revenue: 0 };
      entry.orders += 1;
      entry.revenue += Number(o.grandTotal);
      byMarketplaceMap.set(o.marketplace, entry);
    }
    const byMarketplace = [...byMarketplaceMap.entries()]
      .map(([marketplace, v]) => ({ marketplace, ...v }))
      .sort((a, b) => b.revenue - a.revenue);

    // ---- Produtos mais vendidos ---------------------------------------
    const byProductMap = new Map<string, { title: string; quantity: number; revenue: number }>();
    for (const o of orders) {
      for (const it of o.items) {
        const entry = byProductMap.get(it.sku) ?? {
          title: it.title,
          quantity: 0,
          revenue: 0,
        };
        entry.quantity += it.quantity;
        entry.revenue += Number(it.unitPrice) * it.quantity;
        byProductMap.set(it.sku, entry);
      }
    }
    const topProducts = [...byProductMap.entries()]
      .map(([sku, v]) => ({ sku, ...v }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    return {
      days,
      totals: {
        revenue,
        orders: orderCount,
        avgTicket,
        cost,
        margin,
        marginPct,
        // Transparência: margem só é confiável se o custo cobre os itens
        costCoverage: totalItems > 0 ? (costCoveredItems / totalItems) * 100 : 0,
      },
      byDay,
      byMarketplace,
      topProducts,
    };
  }
}
