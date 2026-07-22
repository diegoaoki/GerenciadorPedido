import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateProductDto } from './create-product.dto';

/** Atualiza campos do produto-pai (variações e opções têm endpoints próprios). */
export class UpdateProductDto extends PartialType(
  OmitType(CreateProductDto, ['variants', 'options'] as const),
) {}
