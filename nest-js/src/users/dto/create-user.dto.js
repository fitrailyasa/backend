const { ApiProperty, PartialType } = require('@nestjs/swagger');
const { IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } = require('class-validator');
const { USER_ROLES } = require('../entities/user.entity');
const { Trim, LowerCase } = require('../../common/decorators/transform.decorator');
const { PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH } = require('../../common/utils/password');

class CreateUserDto {
  @ApiProperty({ type: String, example: 'John Doe', minLength: 3, maxLength: 100 })
  @Trim()
  @IsString({ message: 'Name must be a string.' })
  @MinLength(2, { message: 'Name must be between 2 and 100 characters.' })
  @MaxLength(100, { message: 'Name must be between 2 and 100 characters.' })
  name;

  @ApiProperty({ type: String, example: 'john@example.com', maxLength: 150 })
  @LowerCase()
  @IsEmail({}, { message: 'The email must be a valid email address.' })
  @MaxLength(150, { message: 'Email must be between 3 and 150 characters.' })
  email;

  @ApiProperty({ type: String, example: 'password', minLength: 8, maxLength: 72, writeOnly: true })
  @IsString({ message: 'Password must be a string.' })
  @MinLength(PASSWORD_MIN_LENGTH, { message: 'Password must be at least 8 characters long.' })
  @MaxLength(PASSWORD_MAX_LENGTH, { message: 'Password must be at least 8 characters long.' })
  password;

  @ApiProperty({ enum: USER_ROLES, default: 'user', required: false })
  @IsOptional()
  @IsEnum(USER_ROLES, { message: `Role must be one of: ${USER_ROLES.join(', ')}.` })
  role;
}

class UpdateUserDto extends PartialType(CreateUserDto) {}

module.exports = { CreateUserDto, UpdateUserDto };
