import { IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class AddCartDto {
  @Type(() => Number)
  @IsInt()
  skuId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;
}
