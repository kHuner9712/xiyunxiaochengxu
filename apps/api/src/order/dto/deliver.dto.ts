import { IsString, IsNotEmpty, IsOptional, IsInt, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class DeliverDto {
  @Type(() => Number)
  @IsInt()
  orderId!: number;

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
  @Type(() => Number)
  @IsInt()
  orderId!: number;

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
