import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Min } from 'class-validator';

export class StockAdjustDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: '商品ID格式不正确' })
  productId?: string;

  @IsString()
  @Matches(/^\d+$/, { message: 'SKU ID格式不正确' })
  skuId!: string;

  @IsString()
  @IsIn(['in', 'out'])
  type!: 'in' | 'out';

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsString()
  @IsNotEmpty()
  reason!: string;
}
