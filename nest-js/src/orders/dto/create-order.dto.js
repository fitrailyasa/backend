const { ApiProperty } = require('@nestjs/swagger');
const { Transform, Type } = require('class-transformer');
const {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  Min,
  ValidateNested,
} = require('class-validator');

const toNumber = ({ value }) =>
  value === undefined || value === null || value === '' ? value : Number(value);

class CreateOrderItemDto {
  @ApiProperty({ type: Number, example: 1 })
  @Transform(toNumber)
  @IsInt({ message: 'product_id must be an integer number' })
  @Min(1, { message: 'product_id must be greater than or equal to 1' })
  product_id;

  @ApiProperty({ type: Number, example: 2, minimum: 1 })
  @Transform(toNumber)
  @IsInt({ message: 'quantity must be an integer number' })
  @Min(1, { message: 'quantity must be greater than or equal to 1' })
  quantity;
}

class CreateOrderDto {
  @ApiProperty({ type: [CreateOrderItemDto], example: [{ product_id: 1, quantity: 2 }] })
  @IsArray({ message: 'items must be an array' })
  @ArrayMinSize(1, { message: 'items must contain at least 1 element' })
  @ArrayMaxSize(50, { message: 'items must contain no more than 50 elements' })
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items;
}

module.exports = { CreateOrderDto, CreateOrderItemDto };
