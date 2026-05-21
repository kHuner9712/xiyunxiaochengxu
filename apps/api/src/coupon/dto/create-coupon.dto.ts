import { IsString, IsNotEmpty, IsOptional, IsInt, IsArray, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCouponDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @Type(() => Number)
  @IsInt()
  type: number;

  @Type(() => Number)
  @IsInt()
  value: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  minAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  discountLimit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  totalCount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  perLimit?: number;

  @IsString()
  @IsNotEmpty()
  startTime: string;

  @IsString()
  @IsNotEmpty()
  endTime: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  validDays?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  applicableType?: number;

  @IsOptional()
  @IsArray()
  applicableIds?: number[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  memberLevelId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  isNewUser?: number;
}
