import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { LowerCase, Trim } from '../../common/decorators/transform.decorator';

export class CreateTagDto {
  @ApiProperty({ example: 'Best seller', maxLength: 60 })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MinLength(2, { message: 'Name must be between 2 and 60 characters.' })
  @MaxLength(60, { message: 'Name must be between 2 and 60 characters.' })
  name!: string;

  @ApiPropertyOptional({
    example: 'best-seller',
    description: 'Auto generated from the name when omitted',
    maxLength: 80,
  })
  @LowerCase()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'Slug may only contain lowercase letters, numbers and single hyphens.' })
  slug?: string;
}
