import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { Public } from '../common/decorators/public.decorator';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { QueryCommentsDto } from './dto/query-comments.dto';

@ApiTags('Comments')
@ApiBearerAuth()
@Controller('products/:productId/comments')
export class ProductCommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Public()
  @Get()
  @ResponseMessage('Comments retrieved')
  @ApiParam({ name: 'productId', type: Number })
  @ApiOperation({ summary: 'List the comments of a product' })
  findAll(@Param('productId', ParseIntPipe) productId: number, @Query() query: QueryCommentsDto) {
    return this.commentsService.findAll(query, productId);
  }

  @Post()
  @ResponseMessage('Comment created successfully')
  @ApiParam({ name: 'productId', type: Number })
  @ApiOperation({ summary: 'Comment on a product' })
  create(
    @Param('productId', ParseIntPipe) productId: number,
    @Body() dto: CreateCommentDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.commentsService.create(productId, dto, actor);
  }
}
