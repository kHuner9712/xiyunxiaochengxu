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
  IsIn,
  Matches,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { Type } from 'class-transformer';

type EntityId = string | number;
const MYSQL_SIGNED_INT_MAX = 2_147_483_647;
const PRODUCT_CREATE_REQUEST_ID = /^[1-9]\d{0,18}$/;

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
  @MaxLength(50)
  skuCode?: string;

  @IsOptional()
  specs?: any;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MYSQL_SIGNED_INT_MAX)
  price!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MYSQL_SIGNED_INT_MAX)
  originalPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MYSQL_SIGNED_INT_MAX)
  costPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MYSQL_SIGNED_INT_MAX)
  stock?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  image?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MYSQL_SIGNED_INT_MAX)
  weight?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  barcode?: string;
}

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsString()
  @Matches(/^\d+$/, { message: '分类ID格式不正确' })
  categoryId!: EntityId;

  @IsOptional()
  @IsString()
  @IsIn(['physical', 'virtual'])
  productType?: string;

  @IsOptional()
  @IsString()
  @IsIn(['delivery', 'pickup', 'online', 'none'])
  fulfillmentType?: string;

  @IsOptional()
  @IsString()
  @IsIn(['food', 'clothing', 'photography', 'postpartum_center', 'pilates', 'counseling', 'card_package', 'other'])
  businessCategory?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: '品牌ID格式不正确' })
  brandId?: EntityId;

  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: '供应商ID格式不正确' })
  supplierId?: EntityId;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  mainImage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
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
  @Max(MYSQL_SIGNED_INT_MAX)
  @Validate(RecommendAgeRangeConstraint)
  recommendAgeMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MYSQL_SIGNED_INT_MAX)
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
  @Max(MYSQL_SIGNED_INT_MAX)
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

  // Optional for rolling-upgrade compatibility with an already-cached admin build. The current
  // admin generates one when the create page mounts and reuses it until that logical create ends.
  @IsOptional()
  @IsString()
  @Matches(PRODUCT_CREATE_REQUEST_ID, { message: '商品创建请求ID无效' })
  @MaxLength(19)
  clientRequestId?: string;
}
