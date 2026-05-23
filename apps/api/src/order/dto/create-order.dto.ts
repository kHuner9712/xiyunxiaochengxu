import { IsInt, IsOptional, IsString, IsArray, ValidateNested, Min, Matches } from 'class-validator';
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
  @IsString()
  @Matches(/^\d+$/)
  addressId!: string;

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
