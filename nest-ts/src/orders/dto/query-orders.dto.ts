import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { OrderStatus } from '../entities/order.entity';

export class QueryOrdersDto extends PaginationQueryDto {
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
