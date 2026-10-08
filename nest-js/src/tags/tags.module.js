const { Module } = require('@nestjs/common');
const { TypeOrmModule } = require('@nestjs/typeorm');
const { Tag } = require('./entities/tag.entity');
const { ProductTag } = require('./entities/product-tag.entity');
const { TagsController } = require('./tags.controller');
const { TagsService } = require('./tags.service');

@Module({
  imports: [TypeOrmModule.forFeature([Tag, ProductTag])],
  controllers: [TagsController],
  providers: [TagsService],
  exports: [TagsService],
})
class TagsModule {}

module.exports = { TagsModule };
