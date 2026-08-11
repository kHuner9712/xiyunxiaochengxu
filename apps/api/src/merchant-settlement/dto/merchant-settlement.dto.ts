import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PartialType } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto/pagination.dto';

const POSITIVE_ID = /^[1-9]\d*$/;
const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;

export class CommissionRuleQueryDto extends PaginationDto {
  @IsOptional() @Transform(trim) @IsString() @MaxLength(100) keyword?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(30) ruleType?: string;
  @IsOptional() @Transform(trim) @IsString() @Matches(POSITIVE_ID) merchantPromotionSourceId?: string;
  @IsOptional() @Transform(trim) @IsString() @Matches(POSITIVE_ID) pickupStoreId?: string;
  @IsOptional() @Transform(trim) @IsString() @Matches(POSITIVE_ID) benefitPackageId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1) status?: number;
}

export class CreateCommissionRuleDto {
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(100) name!: string;
  @Transform(trim) @IsString() @IsIn(['sales_referral', 'service_verification']) ruleType!: string;
  @IsOptional() @Transform(trim) @IsString() @Matches(POSITIVE_ID) merchantPromotionSourceId?: string;
  @IsOptional() @Transform(trim) @IsString() @Matches(POSITIVE_ID) pickupStoreId?: string;
  @IsOptional() @Transform(trim) @IsString() @Matches(POSITIVE_ID) benefitPackageId?: string;
  @IsOptional() @Transform(trim) @IsString() @Matches(POSITIVE_ID) benefitPackageItemId?: string;
  @Transform(trim) @IsString() @IsIn(['percent', 'fixed_amount']) calculationType!: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(10000) commissionRate?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) commissionAmount?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) minCommissionAmount?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) maxCommissionAmount?: number;
  @IsOptional() @IsDateString() effectiveStartAt?: string;
  @IsOptional() @IsDateString() effectiveEndAt?: string;
  @IsOptional() @Type(() => Number) @IsInt() @IsIn([0, 1]) status?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) priority?: number;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(500) remark?: string;
}

export class UpdateCommissionRuleDto extends PartialType(CreateCommissionRuleDto) {}

export class CommissionRuleStatusDto {
  @Type(() => Number)
  @IsInt()
  @IsIn([0, 1])
  status!: number;
}

export class CommissionRecordQueryDto extends PaginationDto {
  @IsOptional() @Transform(trim) @IsString() @MaxLength(30) sourceType?: string;
  @IsOptional() @Transform(trim) @IsString() @Matches(POSITIVE_ID) merchantPromotionSourceId?: string;
  @IsOptional() @Transform(trim) @IsString() @Matches(POSITIVE_ID) pickupStoreId?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(30) status?: string;
  @IsOptional() @Transform(trim) @IsString() @Matches(POSITIVE_ID) orderId?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(32) verifyCode?: string;
  @IsOptional() @IsDateString() occurredFrom?: string;
  @IsOptional() @IsDateString() occurredTo?: string;
}

export class CommissionRecordStatusDto {
  @Transform(trim)
  @IsString()
  @IsIn(['pending', 'confirmed', 'settled', 'cancelled'])
  status!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  remark?: string;
}

export class SettlementBatchQueryDto extends PaginationDto {
  @IsOptional() @Transform(trim) @IsString() @Matches(POSITIVE_ID) merchantPromotionSourceId?: string;
  @IsOptional() @Transform(trim) @IsString() @Matches(POSITIVE_ID) pickupStoreId?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(30) status?: string;
  @IsOptional() @IsDateString() periodStart?: string;
  @IsOptional() @IsDateString() periodEnd?: string;
}

export class CreateSettlementBatchDto {
  @IsOptional() @Transform(trim) @IsString() @Matches(POSITIVE_ID) merchantPromotionSourceId?: string;
  @IsOptional() @Transform(trim) @IsString() @Matches(POSITIVE_ID) pickupStoreId?: string;
  @IsDateString() periodStart!: string;
  @IsDateString() periodEnd!: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(500) remark?: string;
}

export class SettlementBatchRemarkDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  remark?: string;
}

export class SettlementReportQueryDto {
  @IsOptional() @Transform(trim) @IsString() @Matches(POSITIVE_ID) merchantPromotionSourceId?: string;
  @IsOptional() @Transform(trim) @IsString() @Matches(POSITIVE_ID) pickupStoreId?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}
