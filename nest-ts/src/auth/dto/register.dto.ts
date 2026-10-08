import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { LowerCase, Trim } from '../../common/decorators/transform.decorator';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../../common/utils/password';

export class RegisterDto {
  @ApiProperty({ example: 'Jane Doe', maxLength: 100 })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 'jane@example.com', maxLength: 150 })
  @LowerCase()
  @IsEmail()
  @MaxLength(150)
  email!: string;

  @ApiProperty({ example: 'password', minLength: PASSWORD_MIN_LENGTH })
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  password!: string;

  @ApiProperty({ example: 'password', description: 'Has to match the password field' })
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  password_confirmation!: string;
}
