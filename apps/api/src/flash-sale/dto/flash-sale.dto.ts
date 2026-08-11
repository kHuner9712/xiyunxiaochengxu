import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

const POSITIVE_ID_PATTERN = /^[1-9]\d*$/;
const EXPLICIT_TIMEZONE_PATTERN = /(?:Z|[+-]\d{2}:\d{2})$/i;
const CLIENT_REQUEST_ID_PATTERN = /^\d{13}-[a-z0-9]{16,40}$/i;

function normalizeId(value: unknown): unknown {
  if (value === undefined || value === null) return value;
  if (typeof value === 'number' && !Number.isSafeInteger(value)) {
    return '__unsafe_numeric_id__';
  }
  return String(value).trim();
}

// ============ 后台：活动查询 ============
export class FlashSaleActivityQueryDto extends PaginationDto {
  @IsOptional() @IsString() keyword?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1) status?: number;

  @IsOptional()
  @Transform(({ value }) => normalizeId(value))
  @IsString()
  @Matches(POSITIVE_ID_PATTERN, { message: '商品ID无效' })
  @MaxLength(19, { message: '商品ID超出范围' })
  productId?: string;
}

// ============ 后台：活动创建/更新 ============
export class FlashSaleActivityDto {
  @IsString() name!: string;

  @Transform(({ value }) => normalizeId(value))
  @IsString()
  @Matches(POSITIVE_ID_PATTERN, { message: '商品ID无效' })
  @MaxLength(19, { message: '商品ID超出范围' })
  productId!: string;

  @Transform(({ value }) => normalizeId(value))
  @IsString()
  @Matches(POSITIVE_ID_PATTERN, { message: 'SKU ID无效' })
  @MaxLength(19, { message: 'SKU ID超出范围' })
  skuId!: string;

  @Type(() => Number) @IsInt() @Min(0) flashPrice!: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) originalPrice?: number;
  @Type(() => Number) @IsInt() @Min(1) stockLimit!: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) limitPerUser?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) lockMinutes?: number;

  @IsString()
  @IsISO8601({}, { message: '开始时间必须为ISO 8601时间' })
  @Matches(EXPLICIT_TIMEZONE_PATTERN, { message: '开始时间必须包含明确时区' })
  startTime!: string;

  @IsString()
  @IsISO8601({}, { message: '结束时间必须为ISO 8601时间' })
  @Matches(EXPLICIT_TIMEZONE_PATTERN, { message: '结束时间必须包含明确时区' })
  endTime!: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1) status?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sortOrder?: number;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() coverImage?: string;
}

// ============ 后台：活动状态 ============
export class FlashSaleActivityStatusDto {
  @Type(() => Number) @IsInt() @Min(0) @Max(1) status!: number;
}

// ============ 后台：秒杀订单查询 ============
export class FlashSaleOrderQueryDto extends PaginationDto {
  @IsOptional()
  @Transform(({ value }) => normalizeId(value))
  @IsString()
  @Matches(POSITIVE_ID_PATTERN, { message: '活动ID无效' })
  @MaxLength(19, { message: '活动ID超出范围' })
  activityId?: string;

  @IsOptional() @IsString() status?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeId(value))
  @IsString()
  @Matches(POSITIVE_ID_PATTERN, { message: '用户ID无效' })
  @MaxLength(19, { message: '用户ID超出范围' })
  userId?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeId(value))
  @IsString()
  @Matches(POSITIVE_ID_PATTERN, { message: '订单ID无效' })
  @MaxLength(19, { message: '订单ID超出范围' })
  orderId?: string;

  @IsOptional() @IsString() startTime?: string;
  @IsOptional() @IsString() endTime?: string;
}

// ============ 小程序：秒杀下单 ============
export class FlashSaleBuyDto {
  @IsString()
  @Matches(CLIENT_REQUEST_ID_PATTERN, { message: '下单请求标识无效' })
  @MaxLength(54, { message: '下单请求标识过长' })
  clientRequestId!: string;

  @Transform(({ value }) => normalizeId(value))
  @IsString()
  @Matches(POSITIVE_ID_PATTERN, { message: '活动ID无效' })
  @MaxLength(19, { message: '活动ID超出范围' })
  activityId!: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) quantity?: number;

  @IsOptional()
  @Transform(({ value }) => normalizeId(value))
  @IsString()
  @Matches(POSITIVE_ID_PATTERN, { message: '收货地址ID无效' })
  @MaxLength(19, { message: '收货地址ID超出范围' })
  addressId?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeId(value))
  @IsString()
  @Matches(POSITIVE_ID_PATTERN, { message: '自提点ID无效' })
  @MaxLength(19, { message: '自提点ID超出范围' })
  pickupStoreId?: string;

  @IsOptional() @IsString() @IsIn(['delivery', 'pickup']) fulfillmentType?: string;
  @IsOptional() @IsString() couponId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) pointsDeduct?: number;
  @IsOptional() @IsString() @IsIn(['direct', 'user_referral', 'merchant_referral', 'campaign']) sourceType?: string;
  @IsOptional() @IsString() @MaxLength(64) sourceCode?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeId(value))
  @IsString()
  @Matches(POSITIVE_ID_PATTERN, { message: '推荐人用户ID无效' })
  @MaxLength(19, { message: '推荐人用户ID超出范围' })
  referrerUserId?: string;

  @IsOptional() @IsString() @MaxLength(200) remark?: string;
}
