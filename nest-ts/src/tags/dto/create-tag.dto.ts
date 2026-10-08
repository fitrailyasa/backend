import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { LowerCase, Trim } from '../../common/decorators/transform.decorator';

export class CreateTagDto {
  @ApiProperty({ example: 'Best seller', maxLength: 60 })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
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
  @Matches(/^[a-z0-9-]*$/, { message: 'slug may only contain lowercase letters, numbers and dashes' })
  slug?: string;
}
