const { ApiProperty } = require('@nestjs/swagger');
const { IsEmail, IsNotEmpty, IsString, MaxLength } = require('class-validator');
const { LowerCase } = require('../../common/decorators/transform.decorator');
const { PASSWORD_MAX_LENGTH } = require('../../common/utils/password');

class LoginDto {
  @ApiProperty({ type: String, example: 'admin@example.com', maxLength: 150 })
  @LowerCase()
  @IsEmail({}, { message: 'The email must be a valid email address.' })
  email;

  @ApiProperty({ type: String, example: 'password', maxLength: 255, writeOnly: true })
  @IsString({ message: 'Password must be a string.' })
  @IsNotEmpty({ message: 'Password is required.' })
  @MaxLength(PASSWORD_MAX_LENGTH, { message: 'Password must be at least 8 characters long.' })
  password;
}

module.exports = { LoginDto };
