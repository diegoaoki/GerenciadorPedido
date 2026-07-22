import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

/** Dados de demonstração para validar o hub sem marketplaces reais. */
async function main() {
  const product = await prisma.product.create({
    data: {
      title: 'Camiseta Básica',
      description: 'Camiseta 100% algodão',
      brand: 'MarcaExemplo',
      category: 'Vestuário',
      variants: {
        create: [
          {
            sku: 'CAM-AZ-M',
            attributes: { tamanho: 'M', cor: 'Azul' } as Prisma.InputJsonValue,
            basePrice: new Prisma.Decimal(59.9),
            costPrice: new Prisma.Decimal(22),
            inventory: { create: { quantity: 30 } },
          },
          {
            sku: 'CAM-AZ-G',
            attributes: { tamanho: 'G', cor: 'Azul' } as Prisma.InputJsonValue,
            basePrice: new Prisma.Decimal(59.9),
            costPrice: new Prisma.Decimal(22),
            inventory: { create: { quantity: 15 } },
          },
        ],
      },
    },
    include: { variants: true },
  });

  const account = await prisma.marketplaceAccount.create({
    data: { marketplace: 'MERCADO_LIVRE', nickname: 'Minha Loja ML' },
  });

  console.log('Seed concluído:', {
    produto: product.title,
    variacoes: product.variants.map((v) => v.sku),
    conta: account.nickname,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
