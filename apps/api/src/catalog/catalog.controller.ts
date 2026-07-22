import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CatalogService } from './catalog.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { SetChannelDescriptionsDto } from './dto/channel-descriptions.dto';

@ApiTags('catalog')
@Controller('products')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.catalog.createProduct(dto);
  }

  @Get()
  list(
    @Query('search') search?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.catalog.listProducts({
      search,
      skip: skip ? Number(skip) : undefined,
      take: take ? Number(take) : undefined,
    });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.catalog.getProduct(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.catalog.updateProduct(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.catalog.deleteProduct(id);
  }

  @Put(':id/descriptions')
  setDescriptions(
    @Param('id') id: string,
    @Body() dto: SetChannelDescriptionsDto,
  ) {
    return this.catalog.setChannelDescriptions(id, dto.entries);
  }
}
