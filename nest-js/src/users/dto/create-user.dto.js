const { ApiProperty, PartialType } = require('@nestjs/swagger');
const { IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } = require('class-validator');
const { USER_ROLES } = require('../entities/user.entity');
const { Trim, LowerCase } = require('../../common/decorators/transform.decorator');
const { PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH } = require('../../common/utils/password');

class CreateUserDto {
  @ApiProperty({ type: String, example: 'John Doe', minLength: 3, maxLength: 100 })
  @Trim()
  @IsString({ message: 'name must be a string' })
  @MinLength(3, { message: 'name must be longer than or equal to 3 characters' })
  @MaxLength(100, { message: 'name must be shorter than or equal to 100 characters' })
  name;

  @ApiProperty({ type: String, example: 'john@example.com', maxLength: 150 })
  @LowerCase()
  @IsEmail({}, { message: 'email must be an email' })
  @MaxLength(150, { message: 'email must be shorter than or equal to 150 characters' })
  email;

  @ApiProperty({ type: String, example: 'password', minLength: 8, maxLength: 72, writeOnly: true })
  @IsString({ message: 'password must be a string' })
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  password;

  @ApiProperty({ enum: USER_ROLES, default: 'user', required: false })
  @IsOptional()
  @IsEnum(USER_ROLES, { message: `role must be one of the following values: ${USER_ROLES.join(', ')}` })
  role;
}

class UpdateUserDto extends PartialType(CreateUserDto) {}

module.exports = { CreateUserDto, UpdateUserDto };
