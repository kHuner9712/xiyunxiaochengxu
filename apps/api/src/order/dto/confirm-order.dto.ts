import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, IsString, Matches, Min, ValidateNested } from 'class-validator';
import { OrderItemDto } from './create-order.dto';

export class ConfirmOrderDto {
  @IsArray()
  @ArrayMinSize(1)
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
