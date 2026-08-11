import { IsString, IsNotEmpty, IsOptional, IsArray, ValidateNested, Matches } from 'class-validator';
import { Type } from 'class-transformer';

// HTTP requests are still required to provide digit strings by the validators below.
// The number union only keeps direct service-level unit fixtures source-compatible.
type DeliveryOrderId = string | number;

export class DeliverDto {
  @IsString()
  @Matches(/^\d+$/, { message: '订单ID格式不正确' })
  orderId!: DeliveryOrderId;

  @IsString()
  @IsNotEmpty()
  logisticsCompany!: string;

  @IsString()
  @IsNotEmpty()
  logisticsNo!: string;

  @IsOptional()
  deliveryImages?: string[];
}

export class DeliverItemDto {
  @IsString()
  @Matches(/^\d+$/, { message: '订单ID格式不正确' })
  orderId!: DeliveryOrderId;

  @IsString()
  @IsNotEmpty()
  logisticsCompany!: string;

  @IsString()
  @IsNotEmpty()
  logisticsNo!: string;
}

export class BatchDeliverDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DeliverItemDto)
  orders!: DeliverItemDto[];
}
