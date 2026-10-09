import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateOrderDto } from './dto/create-order.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { ORDER_INCLUDES, OrdersService } from './orders.service';

@ApiTags('Orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @ResponseMessage('Orders retrieved')
  @ApiOperation({ summary: 'List orders (own orders, or all orders for an admin)' })
  @ApiQuery({ name: 'include', required: false, enum: ORDER_INCLUDES })
  findAll(@Query() query: QueryOrdersDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.ordersService.findAll(query, actor);
  }

  @Get(':id')
  @ResponseMessage('Order retrieved')
  @ApiParam({ name: 'id', type: Number })
  @ApiQuery({ name: 'include', required: false, enum: ORDER_INCLUDES })
  @ApiOperation({ summary: 'Get a single order (owner or admin)' })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: QueryOrdersDto,
  ) {
    return this.ordersService.findOne(id, actor, query.include);
  }

  @Post()
  @ResponseMessage('Order created successfully')
  @ApiOperation({ summary: 'Create an order, total is computed server side' })
  create(@Body() dto: CreateOrderDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.ordersService.create(dto, actor);
  }

  @Patch(':id/status')
  @ResponseMessage('Order status updated successfully')
  @ApiParam({ name: 'id', type: Number })
  @ApiOperation({ summary: 'Update the order status (admin, or owner cancelling a pending order)' })
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.ordersService.updateStatus(id, dto, actor);
  }

  @Delete(':id')
  @Roles('admin')
  @ResponseMessage('Order deleted successfully')
  @ApiParam({ name: 'id', type: Number })
  @ApiOperation({ summary: 'Delete an order (admin only)' })
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() actor: AuthenticatedUser) {
    return this.ordersService.remove(id, actor);
  }
}
