import { IsString, IsNotEmpty, IsOptional, IsArray, ValidateNested, Matches, MaxLength } from 'class-validator';
import { Transform, Type } from 'class-transformer';

// HTTP requests are still required to provide digit strings by the validators below.
// The number union only keeps direct service-level unit fixtures source-compatible.
type DeliveryOrderId = string | number;

export class DeliverDto {
  @IsString()
  @Matches(/^\d+$/, { message: '订单ID格式不正确' })
  orderId!: DeliveryOrderId;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50, { message: '物流公司最多50个字符' })
  logisticsCompany!: string;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50, { message: '物流单号最多50个字符' })
  logisticsNo!: string;

  @IsOptional()
  deliveryImages?: string[];
}

export class DeliverItemDto {
  @IsString()
  @Matches(/^\d+$/, { message: '订单ID格式不正确' })
  orderId!: DeliveryOrderId;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50, { message: '物流公司最多50个字符' })
  logisticsCompany!: string;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50, { message: '物流单号最多50个字符' })
  logisticsNo!: string;
}

export class BatchDeliverDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DeliverItemDto)
  orders!: DeliverItemDto[];
}
