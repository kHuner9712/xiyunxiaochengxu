import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
  Matches,
  MaxLength,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

// HTTP requests are still required to provide digit strings by the validators below.
// The number union only keeps direct service-level unit fixtures source-compatible.
type DeliveryOrderId = string | number;

export class DeliverDto {
  @IsString()
  @Matches(/^[1-9]\d*$/, { message: '订单ID格式不正确' })
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
  @Matches(/^[1-9]\d*$/, { message: '订单ID格式不正确' })
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
  @ArrayMinSize(1, { message: '至少选择1个订单发货' })
  @ArrayMaxSize(50, { message: '单次批量发货最多50个订单' })
  @ValidateNested({ each: true })
  @Type(() => DeliverItemDto)
  orders!: DeliverItemDto[];
}
