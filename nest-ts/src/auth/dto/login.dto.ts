import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { LowerCase } from '../../common/decorators/transform.decorator';
import { PASSWORD_MAX_LENGTH } from '../../common/utils/password';

export class LoginDto {
  @ApiProperty({ example: 'admin@example.com', maxLength: 150 })
  @LowerCase()
  @IsEmail({}, { message: 'The email must be a valid email address.' })
  @MaxLength(150, { message: 'Email must be between 3 and 150 characters.' })
  email!: string;

  @ApiProperty({ example: 'password' })
  @IsString({ message: 'Password must be a string.' })
  @IsNotEmpty({ message: 'Password is required.' })
  @MaxLength(PASSWORD_MAX_LENGTH, { message: 'Password must be at least 8 characters long.' })
  password!: string;
}
