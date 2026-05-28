import { IsInt, IsOptional, IsString, IsArray, ValidateNested, Min, Matches, IsIn, ArrayMinSize, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class OrderItemDto {
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
  @Min(0)
  pointsDeduct?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  remark?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];
}
