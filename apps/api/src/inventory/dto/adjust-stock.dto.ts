import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { StockMovementType } from '@prisma/client';

export class AdjustStockDto {
  /** Positivo = entrada, negativo = saída/ajuste. */
  @IsInt()
  delta!: number;

  @IsOptional()
  @IsEnum(StockMovementType)
  type?: StockMovementType;

  @IsOptional()
  @IsString()
  reason?: string;
}
