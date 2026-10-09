const { ApiProperty, PartialType } = require('@nestjs/swagger');
const { Transform } = require('class-transformer');
const {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} = require('class-validator');
const { Trim } = require('../../common/decorators/transform.decorator');

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SLUG_MESSAGE = 'Slug may only contain lowercase letters, numbers and single hyphens.';
const slugProvided = (_, value) => value !== undefined && value !== null && String(value).trim() !== '';
const toNumber = ({ value }) =>
  value === undefined || value === null || value === '' ? value : Number(value);

class CreateProductDto {
  @ApiProperty({ type: Number, example: 'Wireless Keyboard', minLength: 2, maxLength: 150 })
  @Trim()
  @IsString({ message: 'Name must be a string.' })
  @MinLength(2, { message: 'Name must be between 2 and 150 characters.' })
  @MaxLength(150, { message: 'Name must be between 2 and 150 characters.' })
  name;

  @ApiProperty({ type: Number, example: 1 })
  @Transform(toNumber)
  @IsInt({ message: 'category_id must be a positive integer.' })
  @Min(1, { message: 'category_id must be a positive integer.' })
  category_id;

  @ApiProperty({ type: Number, example: 'Low profile mechanical keyboard', required: false })
  @IsOptional()
  @Trim()
  @IsString({ message: 'description must be a string' })
  @MaxLength(5000, { message: 'description must be shorter than or equal to 5000 characters' })
  description;

  @ApiProperty({ type: Number, example: 149.99, minimum: 0 })
  @Transform(toNumber)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'price must be a number with at most 2 decimal places' },
  )
  @Min(0, { message: 'Price must be a number greater than or equal to 0.' })
  @Max(9999999999.99, { message: 'price is too large' })
  price;

  @ApiProperty({ type: Number, example: 25, minimum: 0, default: 0 })
  @IsOptional()
  @Transform(toNumber)
  @IsInt({ message: 'Stock must be an integer greater than or equal to 0.' })
  @Min(0, { message: 'Stock must be an integer greater than or equal to 0.' })
  stock;

  @ApiProperty({
    type: Number,example: 'wireless-keyboard',
    maxLength: 180,
    required: false,
    description: 'Generated from name when omitted',
  })
  @IsOptional()
  @ValidateIf(slugProvided)
  @IsString({ message: 'Slug must be a string.' })
  @MaxLength(180, { message: 'Slug must be between 1 and 180 characters.' })
  @Matches(SLUG_RE, { message: SLUG_MESSAGE })
  slug;

  @ApiProperty({ example: [1, 2], type: [Number], required: false })
  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value.map((item) => toNumber({ value: item })) : value))
  @IsArray({ message: 'tag_ids must be an array' })
  @ArrayMaxSize(50, { message: 'tag_ids must contain no more than 50 elements' })
  @IsInt({ each: true, message: 'tag_ids must only contain integer numbers' })
  @Min(1, { each: true, message: 'tag_ids must only contain values greater than or equal to 1' })
  tag_ids;
}

class UpdateProductDto extends PartialType(CreateProductDto) {}

module.exports = { CreateProductDto, UpdateProductDto, toNumber };
