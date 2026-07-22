import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Marketplace } from '@prisma/client';
import { AiService } from './ai.service';

class SuggestDescriptionDto {
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @IsEnum(Marketplace)
  marketplace!: Marketplace;

  /** Rascunho atual (opcional) — a IA melhora a partir dele. */
  @IsOptional()
  @IsString()
  draft?: string;
}

@ApiTags('ai')
@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Post('suggest-description')
  suggestDescription(@Body() dto: SuggestDescriptionDto) {
    return this.ai.suggestDescription(dto);
  }
}
