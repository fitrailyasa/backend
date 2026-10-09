import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateBy, ValidationArguments } from 'class-validator';

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 10;
export const MAX_LIMIT = 100;
export const DEFAULT_SORT = 'id';
export const DEFAULT_ORDER = 'desc';

export type SortOrder = 'asc' | 'desc';

/**
 * Base query string of every collection endpoint:
 * `?page&limit&search&sort&order&include`
 */
export class PaginationQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: DEFAULT_PAGE, description: 'Page number' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page: number = DEFAULT_PAGE;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: MAX_LIMIT,
    default: DEFAULT_LIMIT,
    description: 'Items per page',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_LIMIT)
  @IsOptional()
  limit: number = DEFAULT_LIMIT;

  @ApiPropertyOptional({ description: 'LIKE search on the relevant columns (name / email / body)' })
  @IsString()
  @MaxLength(150)
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ default: DEFAULT_SORT, description: 'Column to sort by' })
  @IsString()
  @MaxLength(50)
  @IsOptional()
  sort?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: DEFAULT_ORDER })
  @IsIn(['asc', 'desc'])
  @IsOptional()
  order: SortOrder = DEFAULT_ORDER;

  @ApiPropertyOptional({
    description: 'Comma separated relations to eager load, e.g. ?include=category,tags',
  })
  @IsString()
  @MaxLength(200)
  @IsOptional()
  include?: string;

  get skip(): number {
    return (this.page - 1) * this.limit;
  }

  get take(): number {
    return this.limit;
  }
}

export function IsAllowedInclude(allowed: readonly string[]) {
  return ValidateBy({
    name: 'isAllowedInclude',
    constraints: [allowed],
    validator: {
      validate(value: unknown, args?: ValidationArguments) {
        if (value === undefined || value === null || value === '') return true;
        const allow = (args?.constraints?.[0] as string[]) ?? [];
        return String(value)
          .split(',')
          .map((entry) => entry.trim())
          .filter(Boolean)
          .every((entry) => allow.includes(entry));
      },
      defaultMessage(args?: ValidationArguments) {
        const allow = (args?.constraints?.[0] as string[]) ?? [];
        const invalid = String(args?.value ?? '')
          .split(',')
          .map((entry) => entry.trim())
          .filter(Boolean)
          .filter((entry) => !allow.includes(entry));
        const allowedText = allow.length ? allow.join(', ') : 'none';
        return `Unsupported include value(s): ${invalid.join(', ')}. Allowed: ${allowedText}.`;
      },
    },
  });
}

function sortColumn(allowed: readonly string[]) {
  return IsIn(allowed as string[], { message: `Sort must be one of: ${allowed.join(', ')}.` });
}

const NAME_SORT = ['id', 'name', 'slug', 'created_at', 'updated_at'] as const;

export class CategoryListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @sortColumn(NAME_SORT)
  override sort?: string;

  @IsOptional()
  @IsString()
  @IsAllowedInclude(['products'])
  override include?: string;
}

export class TagListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @sortColumn(NAME_SORT)
  override sort?: string;

  @IsOptional()
  @IsString()
  @IsAllowedInclude(['products'])
  override include?: string;
}

export class UserListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @sortColumn(['id', 'name', 'email', 'role', 'created_at', 'updated_at'])
  override sort?: string;

  @IsOptional()
  @IsString()
  @IsAllowedInclude([])
  override include?: string;
}
