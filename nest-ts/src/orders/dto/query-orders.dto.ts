import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { IsAllowedInclude, PaginationQueryDto } from '../../common/dto/pagination.dto';
import { OrderStatus } from '../entities/order.entity';

const ORDER_SORT = ['id', 'status', 'total', 'created_at', 'updated_at'] as const;

export class QueryOrdersDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @IsIn(ORDER_SORT, { message: `Sort must be one of: ${ORDER_SORT.join(', ')}.` })
  override sort?: string;

  @IsOptional()
  @IsString()
  @IsAllowedInclude(['items', 'items.product', 'user'])
  override include?: string;

  @ApiPropertyOptional({ enum: OrderStatus })
  @IsOptional()
  @IsEnum(OrderStatus, {
    message: `status must be one of the following values: ${Object.values(OrderStatus).join(', ')}`,
  })
  status?: OrderStatus;

  @ApiPropertyOptional({ description: 'Admin only, filter by owner id' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  user_id?: number;
}
