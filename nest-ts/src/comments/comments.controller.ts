import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { Public } from '../common/decorators/public.decorator';
import { CommentsService } from './comments.service';
import { QueryCommentsDto } from './dto/query-comments.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

@ApiTags('Comments')
@ApiBearerAuth()
@Controller('comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Public()
  @Get()
  @ResponseMessage('Comments retrieved')
  @ApiOperation({ summary: 'List comments' })
  findAll(@Query() query: QueryCommentsDto) {
    return this.commentsService.findAll(query);
  }

  @Patch(':id')
  @ResponseMessage('Comment updated successfully')
  @ApiParam({ name: 'id', type: Number })
  @ApiOperation({ summary: 'Update a comment (owner or admin)' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCommentDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.commentsService.update(id, dto, actor);
  }

  @Delete(':id')
  @ResponseMessage('Comment deleted successfully')
  @ApiParam({ name: 'id', type: Number })
  @ApiOperation({ summary: 'Delete a comment (owner or admin)' })
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() actor: AuthenticatedUser) {
    return this.commentsService.remove(id, actor);
  }
}
