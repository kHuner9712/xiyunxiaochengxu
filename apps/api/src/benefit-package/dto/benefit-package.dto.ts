import { Transform, Type } from 'class-transformer';
import {
  IsArray,
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
  ValidateNested,
} from 'class-validator';
import { OmitType, PartialType } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto/pagination.dto';

const POSITIVE_ID = /^[1-9]\d*$/;
const MYSQL_SIGNED_INT_MAX = 2147483647;
const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;

export class BenefitPackagePublicQueryDto extends PaginationDto {}

export class MyBenefitPackageQueryDto extends PaginationDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(30)
  status?: string;
}

export class MyBenefitEntitlementQueryDto extends PaginationDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Matches(POSITIVE_ID)
  packageId?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(30)
  status?: string;
}

export class BenefitPackageQueryDto extends PaginationDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  keyword?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1)
  status?: number;
}

export class UserBenefitPackageQueryDto extends PaginationDto {
  @IsOptional() @Transform(trim) @IsString() @Matches(POSITIVE_ID) userId?: string;
  @IsOptional() @Transform(trim) @IsString() @Matches(POSITIVE_ID) packageId?: string;
  @IsOptional() @Transform(trim) @IsString() @Matches(POSITIVE_ID) orderId?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(30) status?: string;
}

export class EntitlementQueryDto extends PaginationDto {
  @IsOptional() @Transform(trim) @IsString() @Matches(POSITIVE_ID) userId?: string;
  @IsOptional() @Transform(trim) @IsString() @Matches(POSITIVE_ID) packageId?: string;
  @IsOptional() @Transform(trim) @IsString() @Matches(POSITIVE_ID) packageItemId?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(32) verifyCode?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(30) status?: string;
}

export class VerificationLogQueryDto extends PaginationDto {
  @IsOptional() @Transform(trim) @IsString() @Matches(POSITIVE_ID) userId?: string;
  @IsOptional() @Transform(trim) @IsString() @Matches(POSITIVE_ID) packageId?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(32) verifyCode?: string;
  @IsOptional() @Transform(trim) @IsString() @Matches(POSITIVE_ID) verifierId?: string;
}

export class VerifyBenefitDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  verifyCode!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  remark?: string;
}

export class BenefitPackageItemDto {
  @IsOptional() @Transform(trim) @IsString() @Matches(POSITIVE_ID) id?: string;
  @IsOptional() @Transform(trim) @IsString() @Matches(POSITIVE_ID) merchantPromotionSourceId?: string;
  @IsOptional() @Transform(trim) @IsString() @Matches(POSITIVE_ID) pickupStoreId?: string;
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(100) name!: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(30) itemType?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(500) description?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100000) quantity?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(MYSQL_SIGNED_INT_MAX) originalValue?: number;
  @IsOptional() @Type(() => Number) @IsInt() @IsIn([0, 1]) verifyRequired?: number;
  @IsOptional() @Type(() => Number) @IsInt() @IsIn([0, 1]) status?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(MYSQL_SIGNED_INT_MAX) sortOrder?: number;
}

export class CreateBenefitPackageDto {
  @IsOptional() @Transform(trim) @IsString() @Matches(POSITIVE_ID) productId?: string;
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(100) name!: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(200) subtitle?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(500) coverImage?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(5000) description?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(MYSQL_SIGNED_INT_MAX) price?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(3650) validDays?: number;
  @IsOptional() @IsDateString() validStartAt?: string;
  @IsOptional() @IsDateString() validEndAt?: string;
  @IsOptional() @Type(() => Number) @IsInt() @IsIn([0, 1]) status?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(MYSQL_SIGNED_INT_MAX) sortOrder?: number;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => BenefitPackageItemDto) items?: BenefitPackageItemDto[];

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Matches(POSITIVE_ID, { message: '权益包创建请求ID格式不正确' })
  clientRequestId?: string;
}

export class UpdateBenefitPackageDto extends PartialType(
  OmitType(CreateBenefitPackageDto, ['clientRequestId'] as const),
) {}

export class BenefitPackageStatusDto {
  @Type(() => Number)
  @IsInt()
  @IsIn([0, 1])
  status!: number;
}
