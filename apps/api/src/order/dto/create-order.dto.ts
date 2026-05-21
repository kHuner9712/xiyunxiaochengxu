import { IsInt, IsOptional, IsString, IsArray, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';

class OrderItemDto {
  @Type(() => Number)
  @IsInt()
  skuId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CreateOrderDto {
  @Type(() => Number)
  @IsInt()
  addressId!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  couponId?: number;

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
