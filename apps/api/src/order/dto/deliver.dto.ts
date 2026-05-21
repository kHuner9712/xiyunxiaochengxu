import { IsString, IsNotEmpty, IsOptional, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class DeliverDto {
  @Type(() => Number)
  @IsInt()
  orderId: number;

  @IsString()
  @IsNotEmpty()
  logisticsCompany: string;

  @IsString()
  @IsNotEmpty()
  logisticsNo: string;

  @IsOptional()
  deliveryImages?: string[];
}
