import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

const MYSQL_SIGNED_INT_MAX = 2147483647;
const POSITIVE_ID = /^[1-9]\d*$/;
const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;

export class PickupStoreQueryDto extends PaginationDto {
  @IsOptional() @Transform(trim) @IsString() @MaxLength(100) keyword?: string;
  @IsOptional() @Type(() => Number) @IsInt() @IsIn([0, 1]) status?: number;
}

export class CreatePickupStoreDto {
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(100) name!: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(20) contactPhone?: string;
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(20) province!: string;
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(20) city!: string;
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(20) district!: string;
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(200) address!: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-90) @Max(90) latitude?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-180) @Max(180) longitude?: number;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(100) businessHours?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(500) pickupNotice?: string;
  @IsOptional() @Type(() => Number) @IsInt() @IsIn([0, 1]) status?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(MYSQL_SIGNED_INT_MAX) sortOrder?: number;
  @IsOptional() @Transform(trim) @IsString() @Matches(POSITIVE_ID, { message: '自提点创建请求ID格式不正确' }) clientRequestId?: string;
}

export class UpdatePickupStoreDto {
  @IsOptional() @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(100) name?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(20) contactPhone?: string;
  @IsOptional() @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(20) province?: string;
  @IsOptional() @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(20) city?: string;
  @IsOptional() @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(20) district?: string;
  @IsOptional() @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(200) address?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-90) @Max(90) latitude?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-180) @Max(180) longitude?: number;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(100) businessHours?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(500) pickupNotice?: string;
  @IsOptional() @Type(() => Number) @IsInt() @IsIn([0, 1]) status?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(MYSQL_SIGNED_INT_MAX) sortOrder?: number;
}

export class PickupStoreStatusDto {
  @Type(() => Number) @IsInt() @IsIn([0, 1]) status!: number;
}

export class PickupCodeDto {
  @Transform(trim)
  @IsString()
  @Matches(/^\d{8}$/, { message: '自提码必须为8位数字' })
  pickupCode!: string;
}
