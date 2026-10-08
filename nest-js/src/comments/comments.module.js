const { Module } = require('@nestjs/common');
const { TypeOrmModule } = require('@nestjs/typeorm');
const { Comment } = require('./entities/comment.entity');
const { Product } = require('../products/entities/product.entity');
const { CommentsController } = require('./comments.controller');
const { ProductCommentsController } = require('./product-comments.controller');
const { CommentsService } = require('./comments.service');

@Module({
  imports: [TypeOrmModule.forFeature([Comment, Product])],
  controllers: [CommentsController, ProductCommentsController],
  providers: [CommentsService],
  exports: [CommentsService],
})
class CommentsModule {}

module.exports = { CommentsModule };
