const { Type, Transform } = require('class-transformer');
const { IsInt, IsOptional, IsString, IsIn, Max, MaxLength, Min, ValidateBy } = require('class-validator');

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

const IsAllowedInclude = (allowed) =>
  ValidateBy({
    name: 'isAllowedInclude',
    constraints: [allowed],
    validator: {
      validate(value, args) {
        if (value === undefined || value === null || value === '') return true;
        const allow = args.constraints[0];
        return String(value)
          .split(',')
          .map((entry) => entry.trim())
          .filter(Boolean)
          .every((entry) => allow.includes(entry));
      },
      defaultMessage(args) {
        const allow = args.constraints[0] || [];
        const invalid = String(args.value ?? '')
          .split(',')
          .map((entry) => entry.trim())
          .filter(Boolean)
          .filter((entry) => !allow.includes(entry));
        const allowedText = allow.length ? allow.join(', ') : 'none';
        return `Unsupported include value(s): ${invalid.join(', ')}. Allowed: ${allowedText}.`;
      },
    },
  });

/**
 * Collection query with a sort whitelist and an include whitelist.
 * `PaginationQueryDto` stays the loose base used by DTOs that add their own fields.
 */
function queryDto(sortable, includes) {
  class ResourceQueryDto extends PaginationDto {
    @IsOptional()
    @IsString()
    @IsIn(sortable, { message: `Sort must be one of: ${sortable.join(', ')}.` })
    sort;

    @IsOptional()
    @IsString()
    @IsAllowedInclude(includes)
    include;
  }

  return ResourceQueryDto;
}

module.exports = { PaginationDto, PaginationQueryDto: PaginationDto, queryDto, IsAllowedInclude };
