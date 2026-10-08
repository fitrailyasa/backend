const { Controller, Get, Post, Put, Patch, Delete, Param, ParseIntPipe, Inject } = require('@nestjs/common');
const { ApiTags, ApiOperation, ApiBearerAuth } = require('@nestjs/swagger');
const { TagsService } = require('./tags.service');
const { CreateTagDto } = require('./dto/create-tag.dto');
const { UpdateTagDto } = require('./dto/update-tag.dto');
const { PaginationQueryDto } = require('../common/dto/pagination.dto');
const { Public } = require('../common/decorators/public.decorator');
const { Roles } = require('../common/decorators/roles.decorator');
const { ValidatedBody, ValidatedQuery } = require('../common/decorators/validated.decorator');

@ApiTags('Tags')
@Controller('tags')
class TagsController {
  @Inject(TagsService)
  tagsService;

  @Public()
  @Get()
  @ApiOperation({ summary: 'List tags' })
  findAll(@ValidatedQuery(PaginationQueryDto) query) {
    return this.tagsService.findAll(query);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get tag by ID' })
  findOne(@Param('id', ParseIntPipe) id) {
    return this.tagsService.findOne(id);
  }

  @Roles('admin')
  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: 'Create tag (admin)' })
  create(@ValidatedBody(CreateTagDto) payload) {
    return this.tagsService.create(payload);
  }

  @Roles('admin')
  @ApiBearerAuth()
  @Put(':id')
  @ApiOperation({ summary: 'Replace tag (admin)' })
  replace(@Param('id', ParseIntPipe) id, @ValidatedBody(CreateTagDto) payload) {
    return this.tagsService.update(id, payload);
  }

  @Roles('admin')
  @ApiBearerAuth()
  @Patch(':id')
  @ApiOperation({ summary: 'Update tag (admin)' })
  update(@Param('id', ParseIntPipe) id, @ValidatedBody(UpdateTagDto) payload) {
    return this.tagsService.update(id, payload);
  }

  @Roles('admin')
  @ApiBearerAuth()
  @Delete(':id')
  @ApiOperation({ summary: 'Delete tag (admin)' })
  remove(@Param('id', ParseIntPipe) id) {
    return this.tagsService.remove(id);
  }
}

module.exports = { TagsController };
