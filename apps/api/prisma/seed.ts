import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

/** Dados de demonstração para validar o hub sem marketplaces reais. */
async function main() {
  const product = await prisma.product.create({
    data: {
      title: 'Camiseta Personalizada',
      description: 'Camiseta 100% algodão, estampa sob encomenda',
      brand: 'MarcaExemplo',
      category: 'Vestuário',
      fulfillmentType: 'MADE_TO_ORDER',
      productionDays: 7,
      variants: {
        create: [
          {
            sku: 'CAM-M',
            attributes: { tamanho: 'M' } as Prisma.InputJsonValue,
            basePrice: new Prisma.Decimal(59.9),
            costPrice: new Prisma.Decimal(22),
            inventory: { create: { quantity: 0 } },
          },
          {
            sku: 'CAM-G',
            attributes: { tamanho: 'G' } as Prisma.InputJsonValue,
            basePrice: new Prisma.Decimal(59.9),
            costPrice: new Prisma.Decimal(22),
            inventory: { create: { quantity: 0 } },
          },
        ],
      },
      options: {
        create: [
          {
            name: 'Nome estampado',
            type: 'TEXT',
            required: false,
            position: 0,
          },
          {
            name: 'Tipo de estampa',
            type: 'SELECT',
            required: true,
            position: 1,
            choices: {
              create: [
                { label: 'Silk padrão', priceModifier: new Prisma.Decimal(0), position: 0 },
                { label: 'Estampa metálica', priceModifier: new Prisma.Decimal(15), position: 1 },
                { label: 'Bordado', priceModifier: new Prisma.Decimal(25), position: 2 },
              ],
            },
          },
        ],
      },
    },
    include: { variants: true, options: { include: { choices: true } } },
  });

  const account = await prisma.marketplaceAccount.create({
    data: { marketplace: 'MERCADO_LIVRE', nickname: 'Minha Loja ML' },
  });

  console.log('Seed concluído:', {
    produto: product.title,
    modelo: `${product.fulfillmentType} (${product.productionDays} dias)`,
    variacoes: product.variants.map((v) => v.sku),
    opcoes: product.options.map((o) => o.name),
    conta: account.nickname,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
