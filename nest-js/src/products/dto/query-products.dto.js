const { ApiProperty } = require('@nestjs/swagger');
const { Transform } = require('class-transformer');
const { IsIn, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min } = require('class-validator');
const { PaginationDto, IsAllowedInclude } = require('../../common/dto/pagination.dto');
const { Trim } = require('../../common/decorators/transform.decorator');

const toNumber = ({ value }) =>
  value === undefined || value === null || value === '' ? value : Number(value);

const PRODUCT_SORT = ['id', 'name', 'slug', 'price', 'stock', 'category_id', 'created_at', 'updated_at'];

class QueryProductsDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @IsIn(PRODUCT_SORT, { message: `Sort must be one of: ${PRODUCT_SORT.join(', ')}.` })
  sort;

  @ApiProperty({ type: Number, example: 1, required: false })
  @IsOptional()
  @Transform(toNumber)
  @IsInt({ message: 'category_id must be a positive integer.' })
  @Min(1, { message: 'category_id must be a positive integer.' })
  category_id;

  @ApiProperty({ type: Number, example: 1, required: false })
  @IsOptional()
  @Transform(toNumber)
  @IsInt({ message: 'tag_id must be a positive integer.' })
  @Min(1, { message: 'tag_id must be a positive integer.' })
  tag_id;

  @ApiProperty({ type: Number, example: 'featured', required: false, description: 'Filter by tag slug' })
  @IsOptional()
  @Trim()
  @IsString({ message: 'tag must be a string' })
  @MaxLength(80, { message: 'tag must be shorter than or equal to 80 characters' })
  tag;

  @ApiProperty({ type: Number, example: 10, required: false })
  @IsOptional()
  @Transform(toNumber)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'min_price must be a number with at most 2 decimal places' },
  )
  @Min(0, { message: 'min_price must be a number greater than or equal to 0.' })
  min_price;

  @ApiProperty({ type: Number, example: 1000, required: false })
  @IsOptional()
  @Transform(toNumber)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'max_price must be a number with at most 2 decimal places' },
  )
  @Min(0, { message: 'max_price must be a number greater than or equal to 0.' })
  max_price;

  @ApiProperty({
    type: String,example: 'category,tags',
    required: false,
    description: 'Comma separated relations to eager load: category, tags',
  })
  @IsOptional()
  @Trim()
  @IsString({ message: 'include must be a string' })
  @MaxLength(100, { message: 'include must be shorter than or equal to 100 characters' })
  @IsAllowedInclude(['category', 'tags'])
  include;
}

module.exports = { QueryProductsDto };
