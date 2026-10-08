import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class QueryProductsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filter by category id' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  category_id?: number;

  @ApiPropertyOptional({ description: 'Filter by tag id' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  tag_id?: number;

  @ApiPropertyOptional({ description: 'Filter by tag slug' })
  @IsString()
  @MaxLength(80)
  @Matches(/^[a-z0-9-]*$/, { message: 'tag may only contain lowercase letters, numbers and dashes' })
  @IsOptional()
  tag?: string;

  @ApiPropertyOptional({ description: 'Minimum price (inclusive)' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  min_price?: number;

  @ApiPropertyOptional({ description: 'Maximum price (inclusive)' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  max_price?: number;
}
