import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';

const POSITIVE_ID_PATTERN = /^[1-9]\d*$/;
function normalizeId(value: unknown): unknown {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) return '__unsafe_numeric_id__';
  return String(value).trim();
}

export class UpdateCartDto {
  @Transform(({ value }) => normalizeId(value))
  @IsString()
  @Matches(POSITIVE_ID_PATTERN, { message: '购物车ID无效' })
  @MaxLength(19, { message: '购物车ID超出范围' })
  id!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([0, 1])
  isSelected?: number;
}

export class SelectAllCartDto {
  @Type(() => Number)
  @IsInt()
  @IsIn([0, 1])
  isSelected!: number;
}