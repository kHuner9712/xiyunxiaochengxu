import { IsInt, IsOptional, IsString, IsArray, ValidateNested, Min, Matches, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

class OrderItemDto {
  @IsString()
  @Matches(/^\d+$/)
  skuId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
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
  pointsDeduct?: number;

  @IsOptional()
  @IsString()
  remark?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];
}
