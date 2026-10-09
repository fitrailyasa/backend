const { Controller, Get, Post, Put, Patch, Delete, Param, ParseIntPipe, Inject } = require('@nestjs/common');
const { ApiTags, ApiOperation, ApiBearerAuth } = require('@nestjs/swagger');
const { CategoriesService } = require('./categories.service');
const { CreateCategoryDto } = require('./dto/create-category.dto');
const { UpdateCategoryDto } = require('./dto/update-category.dto');
const { queryDto } = require('../common/dto/pagination.dto');

const CategoryQueryDto = queryDto(['id', 'name', 'slug', 'created_at', 'updated_at'], ['products']);
const { Public } = require('../common/decorators/public.decorator');
const { Roles } = require('../common/decorators/roles.decorator');
const { ValidatedBody, ValidatedQuery } = require('../common/decorators/validated.decorator');

@ApiTags('Categories')
@Controller('categories')
class CategoriesController {
  @Inject(CategoriesService)
  categoriesService;

  @Public()
  @Get()
  @ApiOperation({ summary: 'List categories' })
  findAll(@ValidatedQuery(CategoryQueryDto) query) {
    return this.categoriesService.findAll(query);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get category by ID' })
  findOne(@Param('id', ParseIntPipe) id, @ValidatedQuery(CategoryQueryDto) query) {
    return this.categoriesService.findOne(id, query);
  }

  @Roles('admin')
  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: 'Create category (admin)' })
  create(@ValidatedBody(CreateCategoryDto) payload) {
    return this.categoriesService.create(payload);
  }

  @Roles('admin')
  @ApiBearerAuth()
  @Put(':id')
  @ApiOperation({ summary: 'Replace category (admin)' })
  replace(@Param('id', ParseIntPipe) id, @ValidatedBody(CreateCategoryDto) payload) {
    return this.categoriesService.update(id, payload);
  }

  @Roles('admin')
  @ApiBearerAuth()
  @Patch(':id')
  @ApiOperation({ summary: 'Update category (admin)' })
  update(@Param('id', ParseIntPipe) id, @ValidatedBody(UpdateCategoryDto) payload) {
    return this.categoriesService.update(id, payload);
  }

  @Roles('admin')
  @ApiBearerAuth()
  @Delete(':id')
  @ApiOperation({ summary: 'Delete category (admin)' })
  remove(@Param('id', ParseIntPipe) id) {
    return this.categoriesService.remove(id);
  }
}

module.exports = { CategoriesController };
