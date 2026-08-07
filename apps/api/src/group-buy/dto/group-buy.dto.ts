import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

const POSITIVE_ID_PATTERN = /^[1-9]\d*$/;

function normalizeId(value: unknown): unknown {
  if (value === undefined || value === null) return value;
  if (typeof value === 'number' && !Number.isSafeInteger(value)) {
    return '__unsafe_numeric_id__';
  }
  return String(value).trim();
}

// ============ 后台：活动查询 ============
export class GroupBuyActivityQueryDto extends PaginationDto {
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
export class GroupBuyActivityDto {
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

  @Type(() => Number) @IsInt() @Min(0) groupPrice!: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) originalPrice?: number;
  @Type(() => Number) @IsInt() @Min(2) groupSize!: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) groupExpireHours?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) stockLimit?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) limitPerUser?: number;
  @IsString() startTime!: string;
  @IsString() endTime!: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1) status?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sortOrder?: number;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() coverImage?: string;
}

// ============ 后台：活动状态 ============
export class GroupBuyActivityStatusDto {
  @Type(() => Number) @IsInt() @Min(0) @Max(1) status!: number;
}

// ============ 后台：团单查询 ============
export class GroupBuyGroupQueryDto extends PaginationDto {
  @IsOptional()
  @Transform(({ value }) => normalizeId(value))
  @IsString()
  @Matches(POSITIVE_ID_PATTERN, { message: '活动ID无效' })
  @MaxLength(19, { message: '活动ID超出范围' })
  activityId?: string;

  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() groupNo?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeId(value))
  @IsString()
  @Matches(POSITIVE_ID_PATTERN, { message: '团长用户ID无效' })
  @MaxLength(19, { message: '团长用户ID超出范围' })
  leaderUserId?: string;

  @IsOptional() @IsString() startTime?: string;
  @IsOptional() @IsString() endTime?: string;
}

// ============ 后台：成员查询 ============
export class GroupBuyMemberQueryDto extends PaginationDto {
  @IsOptional()
  @Transform(({ value }) => normalizeId(value))
  @IsString()
  @Matches(POSITIVE_ID_PATTERN, { message: '团ID无效' })
  @MaxLength(19, { message: '团ID超出范围' })
  groupId?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeId(value))
  @IsString()
  @Matches(POSITIVE_ID_PATTERN, { message: '活动ID无效' })
  @MaxLength(19, { message: '活动ID超出范围' })
  activityId?: string;

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

  @IsOptional() @IsString() status?: string;
}

// ============ 小程序：开团/参团 ============
export class StartGroupBuyDto {
  @Transform(({ value }) => normalizeId(value))
  @IsString()
  @Matches(POSITIVE_ID_PATTERN, { message: '活动ID无效' })
  @MaxLength(19, { message: '活动ID超出范围' })
  activityId!: string;

  @IsOptional()
  @Transform(({ value }) => normalizeId(value))
  @IsString()
  @Matches(POSITIVE_ID_PATTERN, { message: 'SKU ID无效' })
  @MaxLength(19, { message: 'SKU ID超出范围' })
  skuId?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(1) quantity?: number;
  @IsOptional() @IsString() addressId?: string;
  @IsOptional() @IsString() pickupStoreId?: string;
  @IsOptional() @IsString() fulfillmentType?: string;
  @IsOptional() @IsString() remark?: string;
}

export class JoinGroupBuyDto {
  @Transform(({ value }) => normalizeId(value))
  @IsString()
  @Matches(POSITIVE_ID_PATTERN, { message: '团ID无效' })
  @MaxLength(19, { message: '团ID超出范围' })
  groupId!: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(1) quantity?: number;
  @IsOptional() @IsString() addressId?: string;
  @IsOptional() @IsString() pickupStoreId?: string;
  @IsOptional() @IsString() fulfillmentType?: string;
  @IsOptional() @IsString() remark?: string;
}

// ============ 小程序：可用团查询 ============
export class AvailableGroupQueryDto {
  @Transform(({ value }) => normalizeId(value))
  @IsString()
  @Matches(POSITIVE_ID_PATTERN, { message: '活动ID无效' })
  @MaxLength(19, { message: '活动ID超出范围' })
  activityId!: string;
}
