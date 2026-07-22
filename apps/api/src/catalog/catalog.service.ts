import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  /** Cria produto + variações + opções + estoque inicial em uma transação. */
  async createProduct(dto: CreateProductDto) {
    return this.prisma.product.create({
      data: {
        title: dto.title,
        description: dto.description,
        brand: dto.brand,
        category: dto.category,
        ncm: dto.ncm,
        status: dto.status ?? 'ACTIVE',
        fulfillmentType: dto.fulfillmentType ?? 'MADE_TO_ORDER',
        productionDays: dto.productionDays ?? 7,
        variants: {
          create: dto.variants.map((v) => ({
            sku: v.sku,
            ean: v.ean,
            attributes: (v.attributes ?? {}) as Prisma.InputJsonValue,
            basePrice: new Prisma.Decimal(v.basePrice),
            costPrice:
              v.costPrice != null ? new Prisma.Decimal(v.costPrice) : null,
            weightGrams: v.weightGrams,
            inventory: {
              create: { quantity: v.initialStock ?? 0 },
            },
          })),
        },
        options: dto.options
          ? {
              create: dto.options.map((o, i) => ({
                name: o.name,
                type: o.type,
                required: o.required ?? false,
                position: i,
                choices: o.choices
                  ? {
                      create: o.choices.map((c, ci) => ({
                        label: c.label,
                        priceModifier: new Prisma.Decimal(c.priceModifier ?? 0),
                        position: ci,
                      })),
                    }
                  : undefined,
              })),
            }
          : undefined,
      },
      include: {
        variants: { include: { inventory: true } },
        images: true,
        options: { include: { choices: true } },
      },
    });
  }

  async listProducts(params: { search?: string; skip?: number; take?: number }) {
    const { search, skip = 0, take = 50 } = params;
    const where: Prisma.ProductWhereInput = search
      ? {
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { brand: { contains: search, mode: 'insensitive' } },
            { variants: { some: { sku: { contains: search, mode: 'insensitive' } } } },
          ],
        }
      : {};

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        skip,
        take,
        orderBy: { updatedAt: 'desc' },
        include: {
          variants: { include: { inventory: true, listings: true } },
          images: { orderBy: { position: 'asc' } },
          options: { include: { choices: true }, orderBy: { position: 'asc' } },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    return { items, total, skip, take };
  }

  async getProduct(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        variants: { include: { inventory: true, listings: true } },
        images: { orderBy: { position: 'asc' } },
        options: { include: { choices: true }, orderBy: { position: 'asc' } },
      },
    });
    if (!product) throw new NotFoundException(`Produto ${id} não encontrado`);
    return product;
  }

  async updateProduct(id: string, dto: UpdateProductDto) {
    await this.getProduct(id);
    return this.prisma.product.update({ where: { id }, data: dto });
  }

  async deleteProduct(id: string) {
    await this.getProduct(id);
    await this.prisma.product.delete({ where: { id } });
    return { deleted: true };
  }
}
