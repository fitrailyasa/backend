import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { LowerCase, Trim } from '../../common/decorators/transform.decorator';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Electronics', maxLength: 100 })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MinLength(2, { message: 'Name must be between 2 and 100 characters.' })
  @MaxLength(100, { message: 'Name must be between 2 and 100 characters.' })
  name!: string;

  @ApiPropertyOptional({
    example: 'electronics',
    description: 'Auto generated from the name when omitted',
    maxLength: 120,
  })
  @LowerCase()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'Slug may only contain lowercase letters, numbers and single hyphens.' })
  slug?: string;

  @ApiPropertyOptional({ example: 'Phones, laptops and every other gadget.' })
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}
