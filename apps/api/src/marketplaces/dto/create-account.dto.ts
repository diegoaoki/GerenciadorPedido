import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';
import { Marketplace } from '@prisma/client';

export class CreateAccountDto {
  @IsEnum(Marketplace)
  marketplace!: Marketplace;

  @IsString()
  @IsNotEmpty()
  nickname!: string;

  @IsOptional()
  @IsObject()
  credentials?: Record<string, unknown>;
}
