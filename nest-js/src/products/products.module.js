const { Module } = require('@nestjs/common');
const { TypeOrmModule } = require('@nestjs/typeorm');
const { Product } = require('./entities/product.entity');
const { Category } = require('../categories/entities/category.entity');
const { Tag } = require('../tags/entities/tag.entity');
const { ProductTag } = require('../tags/entities/product-tag.entity');
const { OrderItem } = require('../orders/entities/order-item.entity');
const { ProductsController } = require('./products.controller');
const { ProductsService } = require('./products.service');

@Module({
  imports: [TypeOrmModule.forFeature([Product, Category, Tag, ProductTag, OrderItem])],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
class ProductsModule {}

module.exports = { ProductsModule };
