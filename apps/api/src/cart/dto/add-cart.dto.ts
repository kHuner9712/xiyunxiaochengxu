import { IsOptional, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class AddCartDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  productId?: number;

  @Type(() => Number)
  @IsInt()
  skuId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;
}
