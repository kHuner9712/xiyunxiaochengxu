import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

const POSITIVE_ID_PATTERN = /^[1-9]\d*$/;
const EXPLICIT_TIMEZONE_PATTERN = /(?:Z|[+-]\d{2}:\d{2})$/i;
const MYSQL_SIGNED_INT_MAX = 2147483647;
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const normalizeIds = ({ value }: { value: unknown }) => {
  if (!Array.isArray(value)) return value;
  return value.map((item) => {
    if (typeof item === 'number' && !Number.isSafeInteger(item)) return '__unsafe_numeric_id__';
    return String(item).trim();
  });
};
const normalizeMemberLevelId = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === '') return value;
  if (value === 0 || value === '0') return 0;
  if (typeof value === 'number' && !Number.isSafeInteger(value)) return '__unsafe_numeric_id__';
  return String(value).trim();
};

export class UpdateCouponDto {
  @IsOptional() @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(50) name?: string;
  @IsOptional() @Type(() => Number) @IsInt() @IsIn([1, 2, 3]) type?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(MYSQL_SIGNED_INT_MAX) value?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(MYSQL_SIGNED_INT_MAX) minAmount?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(MYSQL_SIGNED_INT_MAX) discountLimit?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(MYSQL_SIGNED_INT_MAX) totalCount?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(MYSQL_SIGNED_INT_MAX) perLimit?: number;

  @IsOptional()
  @IsString()
  @IsISO8601({}, { message: '优惠券开始时间必须为ISO 8601时间' })
  @Matches(EXPLICIT_TIMEZONE_PATTERN, { message: '优惠券开始时间必须包含明确时区' })
  startTime?: string;

  @IsOptional()
  @IsString()
  @IsISO8601({}, { message: '优惠券结束时间必须为ISO 8601时间' })
  @Matches(EXPLICIT_TIMEZONE_PATTERN, { message: '优惠券结束时间必须包含明确时区' })
  endTime?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(MYSQL_SIGNED_INT_MAX) validDays?: number;
  @IsOptional() @Type(() => Number) @IsInt() @IsIn([0, 1, 2]) applicableType?: number;

  @IsOptional()
  @Transform(normalizeIds)
  @IsArray()
  @IsString({ each: true })
  @Matches(POSITIVE_ID_PATTERN, { each: true, message: '优惠券适用范围ID无效' })
  @MaxLength(19, { each: true, message: '优惠券适用范围ID超出范围' })
  applicableIds?: string[];

  @IsOptional() @Transform(trim) @IsString() @MaxLength(500) description?: string;

  @IsOptional()
  @Transform(normalizeMemberLevelId)
  @ValidateIf((_, value) => value !== 0)
  @IsString()
  @Matches(POSITIVE_ID_PATTERN, { message: '会员等级ID无效' })
  @MaxLength(19, { message: '会员等级ID超出范围' })
  memberLevelId?: any;

  @IsOptional() @Type(() => Number) @IsInt() @IsIn([0, 1]) isNewUser?: number;
  @IsOptional() @Type(() => Number) @IsInt() @IsIn([0, 1]) status?: number;
}
