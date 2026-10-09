import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateProductDto } from './dto/create-product.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService, PRODUCT_INCLUDES } from './products.service';

@ApiTags('Products')
@ApiBearerAuth()
@Roles('admin')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Public()
  @Get()
  @ResponseMessage('Products retrieved')
  @ApiOperation({ summary: 'List products' })
  @ApiQuery({ name: 'include', required: false, enum: PRODUCT_INCLUDES })
  findAll(@Query() query: QueryProductsDto) {
    return this.productsService.findAll(query);
  }

  @Public()
  @Get(':id')
  @ResponseMessage('Product retrieved')
  @ApiParam({ name: 'id', type: Number })
  @ApiQuery({ name: 'include', required: false, enum: PRODUCT_INCLUDES })
  @ApiOperation({ summary: 'Get a single product' })
  findOne(@Param('id', ParseIntPipe) id: number, @Query() query: QueryProductsDto) {
    return this.productsService.findOne(id, query.include);
  }

  @Post()
  @ResponseMessage('Product created successfully')
  @ApiOperation({ summary: 'Create a product (admin only)' })
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Put(':id')
  @ResponseMessage('Product updated successfully')
  @ApiParam({ name: 'id', type: Number })
  @ApiOperation({ summary: 'Replace a product (admin only)' })
  replace(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateProductDto) {
    return this.productsService.update(id, dto);
  }

  @Patch(':id')
  @ResponseMessage('Product updated successfully')
  @ApiParam({ name: 'id', type: Number })
  @ApiOperation({ summary: 'Update a product (admin only)' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }

  @Delete(':id')
  @ResponseMessage('Product deleted successfully')
  @ApiParam({ name: 'id', type: Number })
  @ApiOperation({ summary: 'Delete a product (admin only)' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.remove(id);
  }
}
