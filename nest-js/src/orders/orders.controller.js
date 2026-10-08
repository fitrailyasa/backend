const { Controller, Get, Post, Patch, Delete, Param, ParseIntPipe, Inject } = require('@nestjs/common');
const { ApiTags, ApiOperation, ApiBearerAuth } = require('@nestjs/swagger');
const { OrdersService } = require('./orders.service');
const { CreateOrderDto } = require('./dto/create-order.dto');
const { QueryOrdersDto } = require('./dto/query-orders.dto');
const { UpdateOrderStatusDto } = require('./dto/update-order-status.dto');
const { Roles } = require('../common/decorators/roles.decorator');
const { CurrentUser } = require('../common/decorators/current-user.decorator');
const { ValidatedBody, ValidatedQuery } = require('../common/decorators/validated.decorator');

@ApiTags('Orders')
@ApiBearerAuth()
@Controller('orders')
class OrdersController {
  @Inject(OrdersService)
  ordersService;

  @Get()
  @ApiOperation({ summary: 'List orders (own orders for user, all for admin)' })
  findAll(@ValidatedQuery(QueryOrdersDto) query, @CurrentUser() user) {
    return this.ordersService.findAll(query, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order by ID (owner or admin)' })
  findOne(@Param('id', ParseIntPipe) id, @CurrentUser() user, @ValidatedQuery(QueryOrdersDto) query) {
    return this.ordersService.findOne(id, user, query);
  }

  @Post()
  @ApiOperation({ summary: 'Create order' })
  create(@ValidatedBody(CreateOrderDto) payload, @CurrentUser() user) {
    return this.ordersService.create(payload, user);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update order status' })
  updateStatus(
    @Param('id', ParseIntPipe) id,
    @ValidatedBody(UpdateOrderStatusDto) payload,
    @CurrentUser() user,
  ) {
    return this.ordersService.updateStatus(id, payload, user);
  }

  @Roles('admin')
  @Delete(':id')
  @ApiOperation({ summary: 'Delete order (admin only)' })
  remove(@Param('id', ParseIntPipe) id) {
    return this.ordersService.remove(id);
  }
}

module.exports = { OrdersController };
