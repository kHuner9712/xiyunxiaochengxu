import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsObject,
  IsArray,
  IsBoolean,
  IsIn,
  Matches,
  MaxLength,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

const toSafeIdString = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === '') return value;
  if (typeof value === 'number') return Number.isSafeInteger(value) ? String(value) : '__unsafe_number__';
  return typeof value === 'string' ? value.trim() : value;
};

const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;

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
  @IsString({ each: true })
  requiredComplianceFields?: string[];
}

export class CreateCategoryDto {
  @IsOptional()
  @Transform(toSafeIdString)
  @IsString()
  @Matches(/^(0|[1-9]\d*)$/, { message: '父级分类ID格式不正确' })
  parentId?: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  icon?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([0, 1])
  isShow?: number;

  @IsOptional()
  @IsObject()
  complianceConfig?: CategoryComplianceConfigDto;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Matches(/^[1-9]\d*$/, { message: '分类创建请求ID格式不正确' })
  clientRequestId?: string;
}
