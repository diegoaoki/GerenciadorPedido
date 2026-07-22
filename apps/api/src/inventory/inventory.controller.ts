import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { AdjustStockDto } from './dto/adjust-stock.dto';

@ApiTags('inventory')
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get()
  overview() {
    return this.inventory.overview();
  }

  @Get('sku/:sku')
  bySku(@Param('sku') sku: string) {
    return this.inventory.getBySku(sku);
  }

  @Get(':variantId/movements')
  movements(@Param('variantId') variantId: string) {
    return this.inventory.listMovements(variantId);
  }

  @Post(':variantId/adjust')
  adjust(@Param('variantId') variantId: string, @Body() dto: AdjustStockDto) {
    return this.inventory.adjust({
      variantId,
      delta: dto.delta,
      type: dto.type ?? 'ADJUSTMENT',
      reason: dto.reason,
    });
  }
}
