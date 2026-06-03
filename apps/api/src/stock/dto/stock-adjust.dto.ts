import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class StockAdjustDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  productId?: number;

  @Type(() => Number)
  @IsInt()
  skuId!: number;

  @IsString()
  @IsIn(['in', 'out'])
  type!: 'in' | 'out';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  @IsString()
  reason!: string;
}
