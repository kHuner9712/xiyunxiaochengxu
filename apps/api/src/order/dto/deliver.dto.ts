import { IsString, IsNotEmpty, IsOptional, IsArray, ValidateNested, Matches } from 'class-validator';
import { Type } from 'class-transformer';

export class DeliverDto {
  @IsString()
  @Matches(/^\d+$/, { message: '订单ID格式不正确' })
  orderId!: string;

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
  orderId!: string;

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
