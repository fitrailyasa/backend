import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength } from 'class-validator';
import { LowerCase } from '../../common/decorators/transform.decorator';
import { PASSWORD_MAX_LENGTH } from '../../common/utils/password';

export class LoginDto {
  @ApiProperty({ example: 'admin@example.com', maxLength: 150 })
  @LowerCase()
  @IsEmail()
  @MaxLength(150)
  email!: string;

  @ApiProperty({ example: 'password' })
  @IsString()
  @MaxLength(PASSWORD_MAX_LENGTH)
  password!: string;
}
