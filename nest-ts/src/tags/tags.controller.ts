import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { Public } from '../common/decorators/public.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { TagsService } from './tags.service';

@ApiTags('Tags')
@ApiBearerAuth()
@Roles('admin')
@Controller('tags')
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Public()
  @Get()
  @ResponseMessage('Tags retrieved')
  @ApiOperation({ summary: 'List tags' })
  findAll(@Query() query: PaginationQueryDto) {
    return this.tagsService.findAll(query);
  }

  @Public()
  @Get(':id')
  @ResponseMessage('Tag retrieved')
  @ApiParam({ name: 'id', type: Number })
  @ApiOperation({ summary: 'Get a single tag' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.tagsService.findOne(id);
  }

  @Post()
  @ResponseMessage('Tag created successfully')
  @ApiOperation({ summary: 'Create a tag (admin only)' })
  create(@Body() dto: CreateTagDto) {
    return this.tagsService.create(dto);
  }

  @Put(':id')
  @ResponseMessage('Tag updated successfully')
  @ApiParam({ name: 'id', type: Number })
  @ApiOperation({ summary: 'Replace a tag (admin only)' })
  replace(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateTagDto) {
    return this.tagsService.update(id, dto);
  }

  @Patch(':id')
  @ResponseMessage('Tag updated successfully')
  @ApiParam({ name: 'id', type: Number })
  @ApiOperation({ summary: 'Update a tag (admin only)' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTagDto) {
    return this.tagsService.update(id, dto);
  }

  @Delete(':id')
  @ResponseMessage('Tag deleted successfully')
  @ApiParam({ name: 'id', type: Number })
  @ApiOperation({ summary: 'Delete a tag (admin only)' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.tagsService.remove(id);
  }
}
