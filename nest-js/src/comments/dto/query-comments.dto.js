const { ApiProperty } = require('@nestjs/swagger');
const { Transform } = require('class-transformer');
const { IsInt, IsOptional, Min } = require('class-validator');
const { PaginationDto } = require('../../common/dto/pagination.dto');

const toNumber = ({ value }) =>
  value === undefined || value === null || value === '' ? value : Number(value);

class QueryCommentsDto extends PaginationDto {
  @ApiProperty({ type: Number, example: 1, required: false })
  @IsOptional()
  @Transform(toNumber)
  @IsInt({ message: 'product_id must be an integer number' })
  @Min(1, { message: 'product_id must be greater than or equal to 1' })
  product_id;
}

module.exports = { QueryCommentsDto };
