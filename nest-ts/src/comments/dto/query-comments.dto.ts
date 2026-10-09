import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { IsAllowedInclude, PaginationQueryDto } from '../../common/dto/pagination.dto';

const COMMENT_SORT = ['id', 'body', 'product_id', 'created_at', 'updated_at'] as const;

export class QueryCommentsDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @IsIn(COMMENT_SORT, { message: `Sort must be one of: ${COMMENT_SORT.join(', ')}.` })
  override sort?: string;

  @IsOptional()
  @IsString()
  @IsAllowedInclude(['user', 'product'])
  override include?: string;

  @ApiPropertyOptional({ description: 'Filter by product id' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  product_id?: number;
}
