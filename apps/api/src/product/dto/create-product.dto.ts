import { IsString, IsNotEmpty, IsOptional, IsInt, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class SkuDto {
  @IsOptional()
  @IsString()
  skuCode?: string;

  @IsOptional()
  specs?: any;

  @Type(() => Number)
  @IsInt()
  price!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  originalPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  costPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  stock?: number;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  weight?: number;

  @IsOptional()
  @IsString()
  barcode?: string;
}

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @Type(() => Number)
  @IsInt()
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
