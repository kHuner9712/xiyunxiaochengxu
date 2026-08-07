import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const POSITIVE_ID = /^[1-9]\d*$/;
const EXPLICIT_TIMEZONE = /(?:Z|[+-]\d{2}:\d{2})$/i;
const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;

export class ActivityProductDto {
  @Transform(trim)
  @IsString()
  @Matches(POSITIVE_ID, { message: '商品ID无效' })
  productId!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Matches(POSITIVE_ID, { message: 'SKU ID无效' })
  skuId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  activityPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  activityStock?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  limitPerUser?: number;
}

export class CreateActivityDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  // Keep the existing five admin activity types, but store them as strings because Activity.type
  // is a varchar column and the mini-program/API contract already treats it as string-capable.
  @Transform(trim)
  @IsString()
  @IsIn(['1', '2', '3', '4', '5'])
  type!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsObject()
  rules?: Record<string, unknown>;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  bannerImage?: string;

  @IsString()
  @IsISO8601({}, { message: '活动开始时间必须为ISO 8601时间' })
  @Matches(EXPLICIT_TIMEZONE, { message: '活动开始时间必须包含明确时区' })
  startTime!: string;

  @IsString()
  @IsISO8601({}, { message: '活动结束时间必须为ISO 8601时间' })
  @Matches(EXPLICIT_TIMEZONE, { message: '活动结束时间必须包含明确时区' })
  endTime!: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ActivityProductDto)
  products?: ActivityProductDto[];
}
