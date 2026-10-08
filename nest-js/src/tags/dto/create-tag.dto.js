const { ApiProperty, PartialType } = require('@nestjs/swagger');
const { Transform } = require('class-transformer');
const { IsOptional, IsString, MaxLength, MinLength } = require('class-validator');
const { slugify } = require('../../common/utils/slugify');
const { Trim } = require('../../common/decorators/transform.decorator');

const toSlug = ({ value }) => (typeof value === 'string' ? slugify(value) : value);

class CreateTagDto {
  @ApiProperty({ type: String, example: 'Featured', minLength: 2, maxLength: 60 })
  @Trim()
  @IsString({ message: 'name must be a string' })
  @MinLength(2, { message: 'name must be longer than or equal to 2 characters' })
  @MaxLength(60, { message: 'name must be shorter than or equal to 60 characters' })
  name;

  @ApiProperty({
    type: String,example: 'featured',
    maxLength: 80,
    required: false,
    description: 'Generated from name when omitted',
  })
  @IsOptional()
  @Transform(toSlug)
  @IsString({ message: 'slug must be a string' })
  @MaxLength(80, { message: 'slug must be shorter than or equal to 80 characters' })
  slug;
}

class UpdateTagDto extends PartialType(CreateTagDto) {}

module.exports = { CreateTagDto, UpdateTagDto };
