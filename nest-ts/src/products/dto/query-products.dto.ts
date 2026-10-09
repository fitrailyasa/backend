import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';
import { IsAllowedInclude, PaginationQueryDto } from '../../common/dto/pagination.dto';

const PRODUCT_SORT = ['id', 'name', 'slug', 'price', 'stock', 'category_id', 'created_at', 'updated_at'] as const;

export class QueryProductsDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @IsIn(PRODUCT_SORT, { message: `Sort must be one of: ${PRODUCT_SORT.join(', ')}.` })
  override sort?: string;

  @IsOptional()
  @IsString()
  @IsAllowedInclude(['category', 'tags'])
  override include?: string;

  @ApiPropertyOptional({ description: 'Filter by category id' })
  @Type(() => Number)
  @IsInt({ message: 'category_id must be a positive integer.' })
  @Min(1, { message: 'category_id must be a positive integer.' })
  @IsOptional()
  category_id?: number;

  @ApiPropertyOptional({ description: 'Filter by tag id' })
  @Type(() => Number)
  @IsInt({ message: 'tag_id must be a positive integer.' })
  @Min(1, { message: 'tag_id must be a positive integer.' })
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
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'min_price must be a number greater than or equal to 0.' })
  @Min(0, { message: 'min_price must be a number greater than or equal to 0.' })
  @IsOptional()
  min_price?: number;

  @ApiPropertyOptional({ description: 'Maximum price (inclusive)' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'max_price must be a number greater than or equal to 0.' })
  @Min(0, { message: 'max_price must be a number greater than or equal to 0.' })
  @IsOptional()
  max_price?: number;
}
