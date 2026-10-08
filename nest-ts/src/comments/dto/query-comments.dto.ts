import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class QueryCommentsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filter by product id' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  product_id?: number;
}
