const { Type, Transform } = require('class-transformer');
const { IsInt, IsOptional, IsString, IsIn, Max, MaxLength, Min } = require('class-validator');

const emptyToUndefined = ({ value }) => {
  if (value === '' || value === null) return undefined;
  return value;
};

/**
 * `?page&limit&search&sort&order` - shared by every collection endpoint.
 */
class PaginationDto {
  @Transform(emptyToUndefined)
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page must be an integer number' })
  @Min(1, { message: 'page must be greater than or equal to 1' })
  page;

  @Transform(emptyToUndefined)
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit must be an integer number' })
  @Min(1, { message: 'limit must be greater than or equal to 1' })
  @Max(100, { message: 'limit must be less than or equal to 100' })
  limit;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(150)
  search;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(50)
  sort;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsIn(['asc', 'desc'], { message: 'order must be one of the following values: asc, desc' })
  order;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  include;
}

module.exports = { PaginationDto };
