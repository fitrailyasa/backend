const { ApiProperty, PartialType } = require('@nestjs/swagger');
const { IsOptional, IsString, Matches, MaxLength, MinLength, ValidateIf } = require('class-validator');
const { Trim } = require('../../common/decorators/transform.decorator');

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SLUG_MESSAGE = 'Slug may only contain lowercase letters, numbers and single hyphens.';
const slugProvided = (_, value) => value !== undefined && value !== null && String(value).trim() !== '';

class CreateCategoryDto {
  @ApiProperty({ type: String, example: 'Electronics', minLength: 2, maxLength: 100 })
  @Trim()
  @IsString({ message: 'Name must be a string.' })
  @MinLength(2, { message: 'Name must be between 2 and 100 characters.' })
  @MaxLength(100, { message: 'Name must be between 2 and 100 characters.' })
  name;

  @ApiProperty({
    type: String,example: 'electronics',
    maxLength: 120,
    required: false,
    description: 'Generated from name when omitted',
  })
  @IsOptional()
  @ValidateIf(slugProvided)
  @IsString({ message: 'Slug must be a string.' })
  @MaxLength(120, { message: 'Slug must be between 1 and 120 characters.' })
  @Matches(SLUG_RE, { message: SLUG_MESSAGE })
  slug;

  @ApiProperty({ type: String, example: 'Phones, laptops and accessories', required: false })
  @IsOptional()
  @Trim()
  @IsString({ message: 'Description must be a string.' })
  @MaxLength(2000, { message: 'Description must be at most 2000 characters.' })
  description;
}

class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}

module.exports = { CreateCategoryDto, UpdateCategoryDto };
