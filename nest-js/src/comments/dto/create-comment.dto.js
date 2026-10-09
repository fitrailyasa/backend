const { ApiProperty, PartialType } = require('@nestjs/swagger');
const { IsString, MaxLength, MinLength } = require('class-validator');
const { Trim } = require('../../common/decorators/transform.decorator');

class CreateCommentDto {
  @ApiProperty({
    type: String,example: 'Great keyboard, highly recommended.',
    minLength: 1,
    maxLength: 2000,
  })
  @Trim()
  @IsString({ message: 'Body must be a string.' })
  @MinLength(1, { message: 'Body must be between 1 and 2000 characters.' })
  @MaxLength(2000, { message: 'Body must be between 1 and 2000 characters.' })
  body;
}

class UpdateCommentDto extends PartialType(CreateCommentDto) {}

module.exports = { CreateCommentDto, UpdateCommentDto };
