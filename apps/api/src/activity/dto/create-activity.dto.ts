import { IsString, IsNotEmpty, IsOptional, IsInt, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class ActivityProductDto {
  @Type(() => Number)
  @IsInt()
  productId: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  skuId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  activityPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  activityStock?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limitPerUser?: number;
}

export class CreateActivityDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  type: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  rules?: any;

  @IsOptional()
  @IsString()
  bannerImage?: string;

  @IsString()
  @IsNotEmpty()
  startTime: string;

  @IsString()
  @IsNotEmpty()
  endTime: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ActivityProductDto)
  products?: ActivityProductDto[];
}
