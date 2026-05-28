import { IsString, IsNotEmpty, IsOptional, IsInt, IsArray, ValidateNested, Min, ArrayMinSize, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

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
  brandId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  supplierId?: number;

  @IsOptional()
  @IsString()
  mainImage?: string;

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
  recommendAgeMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  recommendAgeMax?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  isPeriodPurchase?: number;
}
