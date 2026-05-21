import { IsInt, IsString, IsNotEmpty, IsOptional, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAftersaleDto {
  @Type(() => Number)
  @IsInt()
  orderItemId!: number;

  @Type(() => Number)
  @IsInt()
  type!: number;

  @IsString()
  @IsNotEmpty()
  reason!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  images?: string[];
}
