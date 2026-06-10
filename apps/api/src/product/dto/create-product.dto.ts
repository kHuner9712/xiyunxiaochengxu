import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsArray,
  ValidateNested,
  Min,
  ArrayMinSize,
  MaxLength,
  Max,
  ValidateIf,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { Type } from 'class-transformer';

@ValidatorConstraint({ name: 'recommendAgeRange', async: false })
export class RecommendAgeRangeConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const dto = args.object as CreateProductDto;
    if (dto.recommendAgeMin === undefined || dto.recommendAgeMax === undefined) return true;
    return dto.recommendAgeMin <= dto.recommendAgeMax;
  }

  defaultMessage(): string {
    return 'recommendAgeMin 不能大于 recommendAgeMax';
  }
}

export class SkuDto {
  @IsOptional()
  @IsString()
  skuCode?: string;

  @IsOptional()
  specs?: any;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  price!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  originalPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  costPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stock?: number;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  weight?: number;

  @IsOptional()
  @IsString()
  barcode?: string;
}

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  categoryId!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  brandId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  supplierId?: number;

  @IsOptional()
  @IsString()
  mainImage?: string;

  @IsOptional()
  @IsString()
  videoUrl?: string;

  @IsOptional()
  images?: any;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  attributes?: any;

  @IsOptional()
  servicePromise?: any;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SkuDto)
  skus!: SkuDto[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Validate(RecommendAgeRangeConstraint)
  recommendAgeMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Validate(RecommendAgeRangeConstraint)
  recommendAgeMax?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1)
  isPeriodPurchase?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1)
  isRecommend?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @ValidateIf((o: CreateProductDto) => o.status !== undefined)
  @Min(0)
  @Max(3)
  status?: number;
}
