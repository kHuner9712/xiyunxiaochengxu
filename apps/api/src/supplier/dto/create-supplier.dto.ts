import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

const SUPPLIER_CREATE_REQUEST_ID = /^[1-9]\d{0,18}$/;

export class CreateSupplierDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  contactName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  contactPhone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(100)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  businessLicense?: string;

  @IsOptional()
  @IsDateString()
  cooperationStartDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  settlementType?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  remark?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([0, 1])
  status?: number;

  // Optional for rolling-upgrade compatibility with an already-cached admin build. The current
  // admin always sends one for create and keeps it stable until that logical create is resolved.
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Matches(SUPPLIER_CREATE_REQUEST_ID, { message: '供应商创建请求ID无效' })
  @MaxLength(19)
  clientRequestId?: string;
}
