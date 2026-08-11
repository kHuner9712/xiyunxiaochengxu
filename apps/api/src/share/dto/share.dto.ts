import { PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const POSITIVE_ID = /^[1-9]\d*$/;
const TIMEZONE_SUFFIX = /(Z|[+-]\d{2}:\d{2})$/;
const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;

export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000000)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 10;
}

export class ShareRecordDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  shareType!: string;

  @IsOptional()
  @Transform(trim)
  @Matches(POSITIVE_ID)
  shareTargetId?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(50)
  shareChannel?: string;

  @IsOptional()
  @Transform(trim)
  @Matches(POSITIVE_ID)
  campaignId?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  shareScene?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  sharePath?: string;
}

export class ShareVisitDto {
  @IsOptional()
  @Transform(trim)
  @Matches(POSITIVE_ID)
  shareRecordId?: string;

  @IsOptional()
  @Transform(trim)
  @Matches(POSITIVE_ID)
  inviter?: string;

  @IsOptional()
  @Transform(trim)
  @Matches(POSITIVE_ID)
  campaignId?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(32)
  sceneCode?: string;
}

export class BindInviteDto {
  @IsOptional()
  @Transform(trim)
  @Matches(POSITIVE_ID)
  inviter?: string;

  @IsOptional()
  @Transform(trim)
  @Matches(POSITIVE_ID)
  shareRecordId?: string;

  @IsOptional()
  @Transform(trim)
  @Matches(POSITIVE_ID)
  campaignId?: string;
}

export class PosterQueryDto {
  @Transform(trim)
  @IsString()
  @IsIn(['product', 'activity', 'content', 'invite', 'home'])
  type!: string;

  @IsOptional()
  @Transform(trim)
  @Matches(POSITIVE_ID)
  targetId?: string;
}

export class CreateCampaignDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  type!: string;

  @Transform(trim)
  @IsString()
  @IsIn(['points', 'coupon', 'both'])
  rewardType!: 'points' | 'coupon' | 'both';

  @IsOptional()
  @IsObject()
  inviterRewardConfig?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  inviteeRewardConfig?: Record<string, unknown>;

  @Transform(trim)
  @IsISO8601()
  @Matches(TIMEZONE_SUFFIX, { message: '开始时间必须包含明确时区' })
  startTime!: string;

  @Transform(trim)
  @IsISO8601()
  @Matches(TIMEZONE_SUFFIX, { message: '结束时间必须包含明确时区' })
  endTime!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([0, 1])
  status?: number;
}

export class UpdateCampaignDto extends PartialType(CreateCampaignDto) {}

export class UpdateCampaignStatusDto {
  @Type(() => Number)
  @IsInt()
  @IsIn([0, 1])
  status!: number;
}

export class RewardQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(trim)
  @Matches(POSITIVE_ID)
  userId?: string;

  @IsOptional()
  @Transform(trim)
  @Matches(POSITIVE_ID)
  campaignId?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(50)
  rewardType?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(50)
  status?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(80)
  sourceType?: string;
}
