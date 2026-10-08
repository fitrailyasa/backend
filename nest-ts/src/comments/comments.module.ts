import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { Comment } from './entities/comment.entity';
import { ProductCommentsController } from './product-comments.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Comment])],
  controllers: [CommentsController, ProductCommentsController],
  providers: [CommentsService],
  exports: [CommentsService],
})
export class CommentsModule {}
