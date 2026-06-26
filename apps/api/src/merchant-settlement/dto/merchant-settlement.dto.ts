import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min, Max, IsDateString } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

// ===== 规则管理 =====
export class CommissionRuleQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsString()
  ruleType?: string; // sales_referral / service_verification

  @IsOptional()
  @IsString()
  merchantPromotionSourceId?: string;

  @IsOptional()
  @IsString()
  pickupStoreId?: string;

  @IsOptional()
  @IsString()
  benefitPackageId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1)
  status?: number;
}

// ===== 分佣明细 =====
export class CommissionRecordQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  sourceType?: string;

  @IsOptional()
  @IsString()
  merchantPromotionSourceId?: string;

  @IsOptional()
  @IsString()
  pickupStoreId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  orderId?: string;

  @IsOptional()
  @IsString()
  verifyCode?: string;

  @IsOptional()
  @IsString()
  occurredFrom?: string;

  @IsOptional()
  @IsString()
  occurredTo?: string;
}

export class CommissionRecordStatusDto {
  @IsString()
  status!: string; // pending / confirmed / settled / cancelled

  @IsOptional()
  @IsString()
  remark?: string;
}

// ===== 结算批次 =====
export class SettlementBatchQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  merchantPromotionSourceId?: string;

  @IsOptional()
  @IsString()
  pickupStoreId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  periodStart?: string;

  @IsOptional()
  @IsString()
  periodEnd?: string;
}

export class CreateSettlementBatchDto {
  @IsOptional()
  @IsString()
  merchantPromotionSourceId?: string;

  @IsOptional()
  @IsString()
  pickupStoreId?: string;

  @IsDateString()
  periodStart!: string;

  @IsDateString()
  periodEnd!: string;

  @IsOptional()
  @IsString()
  remark?: string;
}

export class SettlementBatchRemarkDto {
  @IsOptional()
  @IsString()
  remark?: string;
}

// ===== 报表 =====
export class SettlementReportQueryDto {
  @IsOptional()
  @IsString()
  merchantPromotionSourceId?: string;

  @IsOptional()
  @IsString()
  pickupStoreId?: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;
}
