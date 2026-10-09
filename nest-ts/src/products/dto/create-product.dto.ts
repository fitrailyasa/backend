import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { LowerCase, Trim } from '../../common/decorators/transform.decorator';

export class CreateProductDto {
  @ApiProperty({ example: 'MacBook Pro 14', maxLength: 150 })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MinLength(2, { message: 'Name must be between 2 and 150 characters.' })
  @MaxLength(150, { message: 'Name must be between 2 and 150 characters.' })
  name!: string;

  @ApiPropertyOptional({
    example: 'macbook-pro-14',
    description: 'Auto generated from the name when omitted',
    maxLength: 180,
  })
  @LowerCase()
  @IsOptional()
  @IsString()
  @MaxLength(180)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'Slug may only contain lowercase letters, numbers and single hyphens.' })
  slug?: string;

  @ApiPropertyOptional({ example: '14 inch laptop with an M3 Pro chip.' })
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiProperty({ example: 3, description: 'Existing category id' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  category_id!: number;

  @ApiProperty({ example: 1999.99, minimum: 0, maximum: 9999999999.99 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9999999999.99)
  price!: number;

  @ApiPropertyOptional({ example: 25, default: 0, maximum: 1000000 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000000)
  @IsOptional()
  stock?: number;

  @ApiPropertyOptional({ example: [1, 2], description: 'Tag ids to attach' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(25)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  tag_ids?: number[];
}
