const { ApiProperty } = require('@nestjs/swagger');
const { Transform } = require('class-transformer');
const { IsIn, IsInt, IsOptional, IsString, Min } = require('class-validator');
const { PaginationDto, IsAllowedInclude } = require('../../common/dto/pagination.dto');

const toNumber = ({ value }) =>
  value === undefined || value === null || value === '' ? value : Number(value);

const COMMENT_SORT = ['id', 'body', 'created_at', 'updated_at'];

class QueryCommentsDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @IsIn(COMMENT_SORT, { message: `Sort must be one of: ${COMMENT_SORT.join(', ')}.` })
  sort;

  @IsOptional()
  @IsString()
  @IsAllowedInclude(['user', 'product'])
  include;

  @ApiProperty({ type: Number, example: 1, required: false })
  @IsOptional()
  @Transform(toNumber)
  @IsInt({ message: 'product_id must be an integer number' })
  @Min(1, { message: 'product_id must be greater than or equal to 1' })
  product_id;
}

module.exports = { QueryCommentsDto };
