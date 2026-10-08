const { Module } = require('@nestjs/common');
const { TypeOrmModule } = require('@nestjs/typeorm');
const { Order } = require('./entities/order.entity');
const { OrderItem } = require('./entities/order-item.entity');
const { Product } = require('../products/entities/product.entity');
const { OrdersController } = require('./orders.controller');
const { OrdersService } = require('./orders.service');

@Module({
  imports: [TypeOrmModule.forFeature([Order, OrderItem, Product])],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
class OrdersModule {}

module.exports = { OrdersModule };
