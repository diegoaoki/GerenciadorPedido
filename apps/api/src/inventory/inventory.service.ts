import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { StockMovementType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { availableForSale } from '../common/fulfillment';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  /** available = quantity - reserved (apenas para itens de estoque físico) */
  private available(inv: { quantity: number; reserved: number }) {
    return inv.quantity - inv.reserved;
  }

  async getBySku(sku: string) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { sku },
      include: { inventory: true, product: true },
    });
    if (!variant)
      throw new NotFoundException(`SKU ${sku} não encontrado`);
    return {
      sku,
      variantId: variant.id,
      fulfillmentType: variant.product.fulfillmentType,
      productionDays: variant.product.productionDays,
      quantity: variant.inventory?.quantity ?? 0,
      reserved: variant.inventory?.reserved ?? 0,
      available: availableForSale(variant.product.fulfillmentType, variant.inventory),
    };
  }

  /**
   * Ajusta o estoque físico e registra a movimentação, atomicamente.
   * delta positivo = entrada, negativo = saída/ajuste.
   */
  async adjust(params: {
    variantId: string;
    delta: number;
    type: StockMovementType;
    reason?: string;
    orderId?: string;
  }) {
    const { variantId, delta, type, reason, orderId } = params;

    return this.prisma.$transaction(async (tx) => {
      const inv = await tx.inventory.findUnique({ where: { variantId } });
      if (!inv)
        throw new NotFoundException(`Estoque da variação ${variantId} não existe`);

      const newQty = inv.quantity + delta;
      if (newQty < 0)
        throw new BadRequestException(
          `Estoque insuficiente: atual ${inv.quantity}, ajuste ${delta}`,
        );

      const updated = await tx.inventory.update({
        where: { variantId },
        data: { quantity: newQty },
      });

      await tx.stockMovement.create({
        data: { variantId, type, quantity: delta, reason, orderId },
      });

      return updated;
    });
  }

  /** Reserva estoque (ex.: pedido pago aguardando envio). */
  async reserve(variantId: string, qty: number, orderId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const inv = await tx.inventory.findUnique({ where: { variantId } });
      if (!inv) throw new NotFoundException('Estoque não encontrado');
      if (this.available(inv) < qty)
        throw new BadRequestException('Estoque disponível insuficiente para reserva');

      const updated = await tx.inventory.update({
        where: { variantId },
        data: { reserved: inv.reserved + qty },
      });
      await tx.stockMovement.create({
        data: { variantId, type: 'RESERVATION', quantity: qty, orderId },
      });
      return updated;
    });
  }

  async listMovements(variantId: string, take = 100) {
    return this.prisma.stockMovement.findMany({
      where: { variantId },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  /** Visão geral do estoque para o painel. */
  async overview() {
    const variants = await this.prisma.productVariant.findMany({
      include: { inventory: true, product: true },
      orderBy: { updatedAt: 'desc' },
    });
    return variants.map((v) => ({
      variantId: v.id,
      sku: v.sku,
      product: v.product.title,
      attributes: v.attributes,
      fulfillmentType: v.product.fulfillmentType,
      productionDays: v.product.productionDays,
      quantity: v.inventory?.quantity ?? 0,
      reserved: v.inventory?.reserved ?? 0,
      available: availableForSale(v.product.fulfillmentType, v.inventory),
    }));
  }
}
