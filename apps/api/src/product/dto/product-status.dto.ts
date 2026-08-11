import { Type } from 'class-transformer';
import { IsIn, IsInt } from 'class-validator';

export class ProductStatusDto {
  @Type(() => Number)
  @IsInt()
  @IsIn([0, 1])
  status!: number;
}
