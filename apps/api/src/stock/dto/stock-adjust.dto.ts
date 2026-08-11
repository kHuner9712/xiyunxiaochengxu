import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

const POSITIVE_ID = /^[1-9]\d*$/;
const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;

export class StockAdjustDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Matches(POSITIVE_ID, { message: '商品ID格式不正确' })
  productId?: string;

  @Transform(trim)
  @IsString()
  @Matches(POSITIVE_ID, { message: 'SKU ID格式不正确' })
  skuId!: string;

  @Transform(trim)
  @IsString()
  @IsIn(['in', 'out'])
  type!: 'in' | 'out';

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2147483647)
  expectedStock!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000000)
  quantity!: number;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  reason!: string;
}
