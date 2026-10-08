const { ApiProperty } = require('@nestjs/swagger');
const { Transform } = require('class-transformer');
const { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } = require('class-validator');
const { PaginationDto } = require('../../common/dto/pagination.dto');
const { ORDER_STATUSES } = require('../entities/order.entity');
const { Trim } = require('../../common/decorators/transform.decorator');

const toNumber = ({ value }) =>
  value === undefined || value === null || value === '' ? value : Number(value);

class QueryOrdersDto extends PaginationDto {
  @ApiProperty({ enum: ORDER_STATUSES, required: false })
  @IsOptional()
  @IsEnum(ORDER_STATUSES, {
    message: `status must be one of the following values: ${ORDER_STATUSES.join(', ')}`,
  })
  status;

  @ApiProperty({ type: Number, example: 1, required: false, description: 'Admin only' })
  @IsOptional()
  @Transform(toNumber)
  @IsInt({ message: 'user_id must be an integer number' })
  @Min(1, { message: 'user_id must be greater than or equal to 1' })
  user_id;

  @ApiProperty({ type: String, example: 'items,user', required: false })
  @IsOptional()
  @Trim()
  @IsString({ message: 'include must be a string' })
  @MaxLength(100, { message: 'include must be shorter than or equal to 100 characters' })
  include;
}

module.exports = { QueryOrdersDto };
