import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { LowerCase, Trim } from '../../common/decorators/transform.decorator';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Electronics', maxLength: 100 })
  @Trim()
  @IsString({ message: 'Name must be a string.' })
  @IsNotEmpty({ message: 'Name is required.' })
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
  @IsString({ message: 'Slug must be a string.' })
  @MaxLength(120, { message: 'Slug must be between 1 and 120 characters.' })
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'Slug may only contain lowercase letters, numbers and single hyphens.' })
  slug?: string;

  @ApiPropertyOptional({ example: 'Phones, laptops and every other gadget.' })
  @Trim()
  @IsOptional()
  @IsString({ message: 'Description must be a string.' })
  @MaxLength(2000, { message: 'Description must be at most 2000 characters.' })
  description?: string;
}
