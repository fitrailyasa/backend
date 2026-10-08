import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { Public } from '../common/decorators/public.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CategoriesService, CATEGORY_INCLUDES } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@ApiTags('Categories')
@ApiBearerAuth()
@Roles('admin')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Public()
  @Get()
  @ResponseMessage('Categories retrieved')
  @ApiOperation({ summary: 'List categories' })
  @ApiQuery({
    name: 'include',
    required: false,
    enum: CATEGORY_INCLUDES,
    description: 'Comma separated relations to eager load',
  })
  findAll(@Query() query: PaginationQueryDto) {
    return this.categoriesService.findAll(query);
  }

  @Public()
  @Get(':id')
  @ResponseMessage('Category retrieved')
  @ApiParam({ name: 'id', type: Number })
  @ApiQuery({ name: 'include', required: false, enum: CATEGORY_INCLUDES })
  @ApiOperation({ summary: 'Get a single category' })
  findOne(@Param('id', ParseIntPipe) id: number, @Query('include') include?: string) {
    return this.categoriesService.findOne(id, include);
  }

  @Post()
  @ResponseMessage('Category created successfully')
  @ApiOperation({ summary: 'Create a category (admin only)' })
  create(@Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(dto);
  }

  @Put(':id')
  @ResponseMessage('Category updated successfully')
  @ApiParam({ name: 'id', type: Number })
  @ApiOperation({ summary: 'Replace a category (admin only)' })
  replace(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateCategoryDto) {
    return this.categoriesService.update(id, dto);
  }

  @Patch(':id')
  @ResponseMessage('Category updated successfully')
  @ApiParam({ name: 'id', type: Number })
  @ApiOperation({ summary: 'Update a category (admin only)' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCategoryDto) {
    return this.categoriesService.update(id, dto);
  }

  @Delete(':id')
  @ResponseMessage('Category deleted successfully')
  @ApiParam({ name: 'id', type: Number })
  @ApiOperation({ summary: 'Delete a category (admin only)' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.categoriesService.remove(id);
  }
}
