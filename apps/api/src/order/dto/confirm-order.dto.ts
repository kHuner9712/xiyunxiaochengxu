import { Type } from 'class-transformer';
import { ArrayMinSize, ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, IsString, Matches, Min, ValidateNested, ValidatorConstraint, ValidatorConstraintInterface, Validate } from 'class-validator';
import { OrderItemDto } from './create-order.dto';
import { CART_MAX_ITEMS } from '@baby-mall/shared';

@ValidatorConstraint({ name: 'confirmUniqueSkuIds' })
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

export class ConfirmOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(CART_MAX_ITEMS)
  @Validate(UniqueSkuIdsConstraint)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];

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
}
