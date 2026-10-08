import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { LowerCase, Trim } from '../../common/decorators/transform.decorator';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Electronics', maxLength: 100 })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
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
  @Matches(/^[a-z0-9-]*$/, { message: 'slug may only contain lowercase letters, numbers and dashes' })
  slug?: string;

  @ApiPropertyOptional({ example: 'Phones, laptops and every other gadget.' })
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}
