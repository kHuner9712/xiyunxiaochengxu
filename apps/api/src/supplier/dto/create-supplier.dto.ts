import { IsString, IsNotEmpty, IsOptional, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSupplierDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  businessLicense?: string;

  @IsOptional()
  @IsString()
  cooperationStartDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  settlementType?: number;

  @IsOptional()
  @IsString()
  remark?: string;
}
