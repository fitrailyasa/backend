const { Controller, Get, Post, Put, Patch, Delete, Param, ParseIntPipe, Inject } = require('@nestjs/common');
const { ApiTags, ApiOperation, ApiBearerAuth } = require('@nestjs/swagger');
const { ProductsService } = require('./products.service');
const { CreateProductDto } = require('./dto/create-product.dto');
const { UpdateProductDto } = require('./dto/update-product.dto');
const { QueryProductsDto } = require('./dto/query-products.dto');
const { Public } = require('../common/decorators/public.decorator');
const { Roles } = require('../common/decorators/roles.decorator');
const { ValidatedBody, ValidatedQuery } = require('../common/decorators/validated.decorator');

@ApiTags('Products')
@Controller('products')
class ProductsController {
  @Inject(ProductsService)
  productsService;

  @Public()
  @Get()
  @ApiOperation({ summary: 'List products' })
  findAll(@ValidatedQuery(QueryProductsDto) query) {
    return this.productsService.findAll(query);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get product by ID' })
  findOne(@Param('id', ParseIntPipe) id, @ValidatedQuery(QueryProductsDto) query) {
    return this.productsService.findOne(id, query);
  }

  @Roles('admin')
  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: 'Create product (admin)' })
  create(@ValidatedBody(CreateProductDto) payload) {
    return this.productsService.create(payload);
  }

  @Roles('admin')
  @ApiBearerAuth()
  @Put(':id')
  @ApiOperation({ summary: 'Replace product (admin)' })
  replace(@Param('id', ParseIntPipe) id, @ValidatedBody(CreateProductDto) payload) {
    return this.productsService.update(id, payload);
  }

  @Roles('admin')
  @ApiBearerAuth()
  @Patch(':id')
  @ApiOperation({ summary: 'Update product (admin)' })
  update(@Param('id', ParseIntPipe) id, @ValidatedBody(UpdateProductDto) payload) {
    return this.productsService.update(id, payload);
  }

  @Roles('admin')
  @ApiBearerAuth()
  @Delete(':id')
  @ApiOperation({ summary: 'Delete product (admin)' })
  remove(@Param('id', ParseIntPipe) id) {
    return this.productsService.remove(id);
  }
}

module.exports = { ProductsController };
