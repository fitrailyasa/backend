const { ApiProperty, PartialType } = require('@nestjs/swagger');
const { IsOptional, IsString, Matches, MaxLength, MinLength, ValidateIf } = require('class-validator');
const { Trim } = require('../../common/decorators/transform.decorator');

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SLUG_MESSAGE = 'Slug may only contain lowercase letters, numbers and single hyphens.';
const slugProvided = (_, value) => value !== undefined && value !== null && String(value).trim() !== '';

class CreateTagDto {
  @ApiProperty({ type: String, example: 'Featured', minLength: 2, maxLength: 60 })
  @Trim()
  @IsString({ message: 'Name must be a string.' })
  @MinLength(2, { message: 'Name must be between 2 and 60 characters.' })
  @MaxLength(60, { message: 'Name must be between 2 and 60 characters.' })
  name;

  @ApiProperty({
    type: String,example: 'featured',
    maxLength: 80,
    required: false,
    description: 'Generated from name when omitted',
  })
  @IsOptional()
  @ValidateIf(slugProvided)
  @IsString({ message: 'Slug must be a string.' })
  @MaxLength(80, { message: 'Slug must be between 1 and 80 characters.' })
  @Matches(SLUG_RE, { message: SLUG_MESSAGE })
  slug;
}

class UpdateTagDto extends PartialType(CreateTagDto) {}

module.exports = { CreateTagDto, UpdateTagDto };
