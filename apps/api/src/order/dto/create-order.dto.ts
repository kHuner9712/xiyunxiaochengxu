import { IsInt, IsOptional, IsString, IsArray, ValidateNested, Min, Max, Matches, IsIn, ArrayMinSize, ArrayMaxSize, MaxLength, ValidatorConstraint, ValidatorConstraintInterface, Validate } from 'class-validator';
import { Type } from 'class-transformer';
import { CART_MAX_QUANTITY, CART_MAX_ITEMS } from '@baby-mall/shared';

@ValidatorConstraint({ name: 'uniqueSkuIds' })
class UniqueSkuIdsConstraint implements ValidatorConstraintInterface {
  validate(items: any[]) {
    if (!Array.isArray(items)) return true;
    const skuIds = items.map((item) => item.skuId);
    return new Set(skuIds).size === skuIds.length;
  }

  defaultMessage() {
    return 'items 中存在重复的 skuId';
  }
}

export class OrderItemDto {
  @IsString()
  @Matches(/^\d+$/)
  skuId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(CART_MAX_QUANTITY)
  quantity!: number;
}

export class CreateOrderDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/)
  addressId?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+$/)
  pickupStoreId?: string;

  @IsOptional()
  @IsString()
  @IsIn(['delivery', 'pickup'])
  fulfillmentType?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+$/)
  couponId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  pointsDeduct?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  remark?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(CART_MAX_ITEMS)
  @Validate(UniqueSkuIdsConstraint)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];
}
