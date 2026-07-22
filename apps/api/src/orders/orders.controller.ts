import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Marketplace, OrderStatus } from '@prisma/client';
import { OrdersService } from './orders.service';

class UpdateStatusDto {
  @IsEnum(OrderStatus)
  status!: OrderStatus;

  @IsOptional()
  @IsString()
  trackingCode?: string;
}

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  list(
    @Query('status') status?: OrderStatus,
    @Query('marketplace') marketplace?: Marketplace,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.orders.list({
      status,
      marketplace,
      skip: skip ? Number(skip) : undefined,
      take: take ? Number(take) : undefined,
    });
  }

  @Get('summary')
  summary() {
    return this.orders.summary();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.orders.get(id);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto) {
    return this.orders.updateStatus(id, dto.status, dto.trackingCode);
  }
}
