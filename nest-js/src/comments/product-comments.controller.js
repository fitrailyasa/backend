const { Controller, Get, Post, Param, ParseIntPipe, Inject } = require('@nestjs/common');
const { ApiTags, ApiOperation, ApiBearerAuth } = require('@nestjs/swagger');
const { CommentsService } = require('./comments.service');
const { CreateCommentDto } = require('./dto/create-comment.dto');
const { QueryCommentsDto } = require('./dto/query-comments.dto');
const { Public } = require('../common/decorators/public.decorator');
const { CurrentUser } = require('../common/decorators/current-user.decorator');
const { ValidatedBody, ValidatedQuery } = require('../common/decorators/validated.decorator');

@ApiTags('Comments')
@Controller('products/:productId/comments')
class ProductCommentsController {
  @Inject(CommentsService)
  commentsService;

  @Public()
  @Get()
  @ApiOperation({ summary: 'List comments of a product' })
  findAll(
    @Param('productId', ParseIntPipe) productId,
    @ValidatedQuery(QueryCommentsDto) query,
  ) {
    return this.commentsService.findAll(query, productId);
  }

  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: 'Add a comment to a product' })
  create(
    @Param('productId', ParseIntPipe) productId,
    @ValidatedBody(CreateCommentDto) payload,
    @CurrentUser() user,
  ) {
    return this.commentsService.create(productId, payload, user);
  }
}

module.exports = { ProductCommentsController };
