const { ApiProperty } = require('@nestjs/swagger');
const { IsEnum } = require('class-validator');
const { ORDER_STATUSES } = require('../entities/order.entity');

class UpdateOrderStatusDto {
  @ApiProperty({ enum: ORDER_STATUSES, example: 'paid' })
  @IsEnum(ORDER_STATUSES, {
    message: `Status must be one of: ${ORDER_STATUSES.join(', ')}.`,
  })
  status;
}

module.exports = { UpdateOrderStatusDto };
