import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

// ============ 后台：活动查询 ============
export class GroupBuyActivityQueryDto extends PaginationDto {
  @IsOptional() @IsString() keyword?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1) status?: number;
  @IsOptional() @Type(() => Number) @IsInt() productId?: number;
}

// ============ 后台：活动创建/更新 ============
export class GroupBuyActivityDto {
  @IsString() name!: string;
  @Type(() => Number) @IsInt() productId!: number;
  @IsOptional() @Type(() => Number) @IsInt() skuId?: number;
  @Type(() => Number) @IsInt() @Min(0) groupPrice!: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) originalPrice?: number;
  @Type(() => Number) @IsInt() @Min(1) groupSize!: number;
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
  @IsOptional() @Type(() => Number) @IsInt() activityId?: number;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() groupNo?: string;
  @IsOptional() @Type(() => Number) @IsInt() leaderUserId?: number;
  @IsOptional() @IsString() startTime?: string;
  @IsOptional() @IsString() endTime?: string;
}

// ============ 后台：成员查询 ============
export class GroupBuyMemberQueryDto extends PaginationDto {
  @IsOptional() @Type(() => Number) @IsInt() groupId?: number;
  @IsOptional() @Type(() => Number) @IsInt() activityId?: number;
  @IsOptional() @Type(() => Number) @IsInt() userId?: number;
  @IsOptional() @Type(() => Number) @IsInt() orderId?: number;
  @IsOptional() @IsString() status?: string;
}

// ============ 小程序：开团/参团 ============
export class StartGroupBuyDto {
  @Type(() => Number) @IsInt() activityId!: number;
  @IsOptional() @Type(() => Number) @IsInt() skuId?: number;
  @IsOptional() @Type(() => Number) @IsInt() quantity?: number;
  @IsOptional() @IsString() addressId?: string;
  @IsOptional() @IsString() pickupStoreId?: string;
  @IsOptional() @IsString() fulfillmentType?: string;
  @IsOptional() @IsString() remark?: string;
}

export class JoinGroupBuyDto {
  @Type(() => Number) @IsInt() groupId!: number;
  @IsOptional() @Type(() => Number) @IsInt() quantity?: number;
  @IsOptional() @IsString() addressId?: string;
  @IsOptional() @IsString() pickupStoreId?: string;
  @IsOptional() @IsString() fulfillmentType?: string;
  @IsOptional() @IsString() remark?: string;
}

// ============ 小程序：可用团查询 ============
export class AvailableGroupQueryDto {
  @Type(() => Number) @IsInt() activityId!: number;
}
