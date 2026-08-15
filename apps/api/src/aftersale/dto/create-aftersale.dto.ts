import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateAftersaleDto {
  @IsString()
  @Matches(/^[1-9]\d*$/, { message: '订单ID格式无效' })
  @IsNotEmpty()
  orderId!: string;

  @IsString()
  @Matches(/^[1-9]\d*$/, { message: '订单商品ID格式无效' })
  @IsNotEmpty()
  orderItemId!: string;

  @IsIn([1, 2])
  type!: number;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200, { message: '售后原因不能超过200个字符' })
  reason!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(128, { each: true })
  @Matches(/^\/api\/common\/file\/private\/[1-9]\d*$/, { each: true })
  images?: string[];
}
