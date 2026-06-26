import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

// ============ 后台：活动查询 ============
export class FlashSaleActivityQueryDto extends PaginationDto {
  @IsOptional() @IsString() keyword?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1) status?: number;
  @IsOptional() @Type(() => Number) @IsInt() productId?: number;
}

// ============ 后台：活动创建/更新 ============
export class FlashSaleActivityDto {
  @IsString() name!: string;
  @Type(() => Number) @IsInt() productId!: number;
  @IsOptional() @Type(() => Number) @IsInt() skuId?: number;
  @Type(() => Number) @IsInt() @Min(0) flashPrice!: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) originalPrice?: number;
  @Type(() => Number) @IsInt() @Min(0) stockLimit!: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) limitPerUser?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) lockMinutes?: number;
  @IsString() startTime!: string;
  @IsString() endTime!: string;
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
  @IsOptional() @Type(() => Number) @IsInt() activityId?: number;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @Type(() => Number) @IsInt() userId?: number;
  @IsOptional() @Type(() => Number) @IsInt() orderId?: number;
  @IsOptional() @IsString() startTime?: string;
  @IsOptional() @IsString() endTime?: string;
}

// ============ 小程序：秒杀下单 ============
export class FlashSaleBuyDto {
  @Type(() => Number) @IsInt() activityId!: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) quantity?: number;
  @IsOptional() @IsString() addressId?: string;
  @IsOptional() @IsString() pickupStoreId?: string;
  @IsOptional() @IsString() fulfillmentType?: string;
  @IsOptional() @IsString() couponId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) pointsDeduct?: number;
  @IsOptional() @IsString() sourceType?: string;
  @IsOptional() @IsString() sourceCode?: string;
  @IsOptional() @IsString() referrerUserId?: string;
  @IsOptional() @IsString() remark?: string;
}
