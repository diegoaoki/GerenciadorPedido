import { IsArray, IsEnum, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { Marketplace } from '@prisma/client';

export class ChannelDescriptionEntryDto {
  @IsEnum(Marketplace)
  marketplace!: Marketplace;

  /** Texto vazio remove a descrição do canal (volta a usar a base). */
  @IsString()
  description!: string;
}

export class SetChannelDescriptionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChannelDescriptionEntryDto)
  entries!: ChannelDescriptionEntryDto[];
}
