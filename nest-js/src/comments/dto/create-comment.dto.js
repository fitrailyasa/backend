const { ApiProperty, PartialType } = require('@nestjs/swagger');
const { IsString, MaxLength, MinLength } = require('class-validator');
const { Trim } = require('../../common/decorators/transform.decorator');

class CreateCommentDto {
  @ApiProperty({
    type: String,example: 'Great keyboard, highly recommended.',
    minLength: 1,
    maxLength: 5000,
  })
  @Trim()
  @IsString({ message: 'body must be a string' })
  @MinLength(1, { message: 'body should not be empty' })
  @MaxLength(5000, { message: 'body must be shorter than or equal to 5000 characters' })
  body;
}

class UpdateCommentDto extends PartialType(CreateCommentDto) {}

module.exports = { CreateCommentDto, UpdateCommentDto };
