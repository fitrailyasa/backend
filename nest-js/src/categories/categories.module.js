const { Module } = require('@nestjs/common');
const { TypeOrmModule } = require('@nestjs/typeorm');
const { Category } = require('./entities/category.entity');
const { Product } = require('../products/entities/product.entity');
const { CategoriesController } = require('./categories.controller');
const { CategoriesService } = require('./categories.service');

@Module({
  imports: [TypeOrmModule.forFeature([Category, Product])],
  controllers: [CategoriesController],
  providers: [CategoriesService],
  exports: [CategoriesService],
})
class CategoriesModule {}

module.exports = { CategoriesModule };
