-- CreateTable
CREATE TABLE "ProductChannelDescription" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "marketplace" "Marketplace" NOT NULL,
    "description" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductChannelDescription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductChannelDescription_productId_marketplace_key" ON "ProductChannelDescription"("productId", "marketplace");

-- AddForeignKey
ALTER TABLE "ProductChannelDescription" ADD CONSTRAINT "ProductChannelDescription_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
