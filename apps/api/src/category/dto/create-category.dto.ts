import { IsString, IsNotEmpty, IsOptional, IsInt, IsObject, IsArray, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class CategoryComplianceConfigDto {
  @IsOptional()
  @IsBoolean()
  isFood?: boolean;

  @IsOptional()
  @IsBoolean()
  isHealthSupplement?: boolean;

  @IsOptional()
  @IsBoolean()
  isInfantFormula?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresCertImages?: boolean;

  @IsOptional()
  @IsArray()
  requiredComplianceFields?: string[];
}

export class CreateCategoryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  parentId?: number;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  isShow?: number;

  @IsOptional()
  @IsObject()
  complianceConfig?: CategoryComplianceConfigDto;
}
