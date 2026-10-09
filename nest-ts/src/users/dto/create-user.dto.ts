import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { LowerCase, Trim } from '../../common/decorators/transform.decorator';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../../common/utils/password';
import { UserRole } from '../entities/user.entity';

export class CreateUserDto {
  @ApiProperty({ example: 'Jane Doe', maxLength: 100 })
  @Trim()
  @IsString({ message: 'Name must be a string.' })
  @IsNotEmpty({ message: 'Name is required.' })
  @MinLength(2, { message: 'Name must be between 2 and 100 characters.' })
  @MaxLength(100, { message: 'Name must be between 2 and 100 characters.' })
  name!: string;

  @ApiProperty({ example: 'jane@example.com', maxLength: 150 })
  @LowerCase()
  @IsEmail({}, { message: 'The email must be a valid email address.' })
  @MaxLength(150, { message: 'Email must be between 3 and 150 characters.' })
  email!: string;

  @ApiProperty({ example: 'password', minLength: PASSWORD_MIN_LENGTH })
  @IsString({ message: 'Password must be a string.' })
  @MinLength(PASSWORD_MIN_LENGTH, { message: 'Password must be at least 8 characters long.' })
  @MaxLength(PASSWORD_MAX_LENGTH, { message: 'Password must be at least 8 characters long.' })
  password!: string;

  @ApiPropertyOptional({ enum: UserRole, default: UserRole.USER })
  @IsOptional()
  @IsEnum(UserRole, { message: 'Role must be one of: user, admin.' })
  role?: UserRole;
}
