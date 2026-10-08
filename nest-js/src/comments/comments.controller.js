const { Controller, Get, Patch, Delete, Param, ParseIntPipe, Inject } = require('@nestjs/common');
const { ApiTags, ApiOperation, ApiBearerAuth } = require('@nestjs/swagger');
const { CommentsService } = require('./comments.service');
const { UpdateCommentDto } = require('./dto/update-comment.dto');
const { QueryCommentsDto } = require('./dto/query-comments.dto');
const { Public } = require('../common/decorators/public.decorator');
const { CurrentUser } = require('../common/decorators/current-user.decorator');
const { ValidatedBody, ValidatedQuery } = require('../common/decorators/validated.decorator');

@ApiTags('Comments')
@Controller('comments')
class CommentsController {
  @Inject(CommentsService)
  commentsService;

  @Public()
  @Get()
  @ApiOperation({ summary: 'List comments' })
  findAll(@ValidatedQuery(QueryCommentsDto) query) {
    return this.commentsService.findAll(query);
  }

  @ApiBearerAuth()
  @Patch(':id')
  @ApiOperation({ summary: 'Update comment (owner or admin)' })
  update(
    @Param('id', ParseIntPipe) id,
    @ValidatedBody(UpdateCommentDto) payload,
    @CurrentUser() user,
  ) {
    return this.commentsService.update(id, payload, user);
  }

  @ApiBearerAuth()
  @Delete(':id')
  @ApiOperation({ summary: 'Delete comment (owner or admin)' })
  remove(@Param('id', ParseIntPipe) id, @CurrentUser() user) {
    return this.commentsService.remove(id, user);
  }
}

module.exports = { CommentsController };
