import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateSupplierDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(100) name?: string;
  @IsOptional() @IsString() @MaxLength(50) contactName?: string;
  @IsOptional() @IsString() @MaxLength(20) contactPhone?: string;
  @IsOptional() @IsString() @MaxLength(300) address?: string;
  @IsOptional() @IsString() @MaxLength(500) businessLicense?: string;
  @IsOptional() @IsDateString() cooperationStartDate?: string;
  @IsOptional() @Type(() => Number) @IsInt() settlementType?: number;
  @IsOptional() @IsString() @MaxLength(2000) remark?: string;
}

export class SupplierStatusDto {
  @Type(() => Number)
  @IsInt()
  @IsIn([0, 1])
  status!: number;
}
