import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { FulfillmentType, ProductOptionType, ProductStatus } from '@prisma/client';

export class CreateVariantDto {
  @IsString()
  @IsNotEmpty()
  sku!: string;

  @IsOptional()
  @IsString()
  ean?: string;

  /** Ex.: { "tamanho": "M", "cor": "Azul" } */
  @IsOptional()
  @IsObject()
  attributes?: Record<string, string>;

  @IsNumber()
  @Min(0)
  basePrice!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  costPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  weightGrams?: number;

  /** Quantidade inicial de estoque (opcional). */
  @IsOptional()
  @IsNumber()
  @Min(0)
  initialStock?: number;
}

export class OptionChoiceDto {
  @IsString()
  @IsNotEmpty()
  label!: string;

  @IsOptional()
  @IsNumber()
  priceModifier?: number;
}

export class CreateOptionDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEnum(ProductOptionType)
  type!: ProductOptionType;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  /** Alternativas — obrigatórias quando type = SELECT. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OptionChoiceDto)
  choices?: OptionChoiceDto[];
}

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  ncm?: string;

  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @IsOptional()
  @IsEnum(FulfillmentType)
  fulfillmentType?: FulfillmentType;

  /** Prazo de produção em dias (padrão 7 para sob encomenda). */
  @IsOptional()
  @IsInt()
  @Min(0)
  productionDays?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateVariantDto)
  variants!: CreateVariantDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOptionDto)
  options?: CreateOptionDto[];
}
