const { ApiProperty, PartialType } = require('@nestjs/swagger');
const { Transform } = require('class-transformer');
const { IsOptional, IsString, MaxLength, MinLength } = require('class-validator');
const { slugify } = require('../../common/utils/slugify');
const { Trim } = require('../../common/decorators/transform.decorator');

const toSlug = ({ value }) => (typeof value === 'string' ? slugify(value) : value);

class CreateCategoryDto {
  @ApiProperty({ type: String, example: 'Electronics', minLength: 2, maxLength: 100 })
  @Trim()
  @IsString({ message: 'name must be a string' })
  @MinLength(2, { message: 'name must be longer than or equal to 2 characters' })
  @MaxLength(100, { message: 'name must be shorter than or equal to 100 characters' })
  name;

  @ApiProperty({
    type: String,example: 'electronics',
    maxLength: 120,
    required: false,
    description: 'Generated from name when omitted',
  })
  @IsOptional()
  @Transform(toSlug)
  @IsString({ message: 'slug must be a string' })
  @MaxLength(120, { message: 'slug must be shorter than or equal to 120 characters' })
  slug;

  @ApiProperty({ type: String, example: 'Phones, laptops and accessories', required: false })
  @IsOptional()
  @Trim()
  @IsString({ message: 'description must be a string' })
  @MaxLength(2000, { message: 'description must be shorter than or equal to 2000 characters' })
  description;
}

class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}

module.exports = { CreateCategoryDto, UpdateCategoryDto };
