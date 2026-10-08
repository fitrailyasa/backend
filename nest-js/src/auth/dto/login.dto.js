const { ApiProperty } = require('@nestjs/swagger');
const { IsEmail, IsNotEmpty, IsString, MaxLength } = require('class-validator');
const { LowerCase } = require('../../common/decorators/transform.decorator');
const { PASSWORD_MAX_LENGTH } = require('../../common/utils/password');

class LoginDto {
  @ApiProperty({ type: String, example: 'admin@example.com', maxLength: 150 })
  @LowerCase()
  @IsEmail({}, { message: 'email must be an email' })
  email;

  @ApiProperty({ type: String, example: 'password', maxLength: 255, writeOnly: true })
  @IsString({ message: 'password must be a string' })
  @IsNotEmpty({ message: 'password should not be empty' })
  @MaxLength(PASSWORD_MAX_LENGTH)
  password;
}

module.exports = { LoginDto };
