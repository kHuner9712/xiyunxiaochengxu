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
  MaxLength,
  Min,
} from 'class-validator';

const POSITIVE_ID_PATTERN = /^[1-9]\d*$/;
const EXPLICIT_TIMEZONE_PATTERN = /(?:Z|[+-]\d{2}:\d{2})$/i;
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const normalizeIds = ({ value }: { value: unknown }) => {
  if (!Array.isArray(value)) return value;
  return value.map((item) => {
    if (typeof item === 'number' && !Number.isSafeInteger(item)) return '__unsafe_numeric_id__';
    return String(item).trim();
  });
};

export class UpdateCouponDto {
  @IsOptional() @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(100) name?: string;
  @IsOptional() @Type(() => Number) @IsInt() @IsIn([1, 2, 3, 4]) type?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) value?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) minAmount?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) discountLimit?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) maxDiscount?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) totalCount?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) perLimit?: number;

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

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) validDays?: number;
  @IsOptional() @Type(() => Number) @IsInt() @IsIn([0, 1, 2]) applicableType?: number;
  @IsOptional()
  @Transform(normalizeIds)
  @IsArray()
  @IsString({ each: true })
  @Matches(POSITIVE_ID_PATTERN, { each: true, message: '优惠券适用范围ID无效' })
  @MaxLength(19, { each: true, message: '优惠券适用范围ID超出范围' })
  applicableIds?: string[];
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) memberLevelId?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) memberLevel?: number;
  @IsOptional() @Type(() => Number) @IsInt() @IsIn([0, 1]) isNewUser?: number;
}