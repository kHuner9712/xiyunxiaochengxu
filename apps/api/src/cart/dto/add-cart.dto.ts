import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';

const POSITIVE_ID_PATTERN = /^[1-9]\d*$/;
const CLIENT_REQUEST_ID = /^\d{13}-[a-z0-9]{16,40}$/i;
function normalizeId(value: unknown): unknown {
  if (value === undefined || value === null) return value;
  if (typeof value === 'number' && !Number.isSafeInteger(value)) return '__unsafe_numeric_id__';
  return String(value).trim();
}

export class AddCartDto {
  @IsOptional()
  @Transform(({ value }) => normalizeId(value))
  @IsString()
  @Matches(POSITIVE_ID_PATTERN, { message: '商品ID无效' })
  @MaxLength(19, { message: '商品ID超出范围' })
  productId?: string;

  @Transform(({ value }) => normalizeId(value))
  @IsString()
  @Matches(POSITIVE_ID_PATTERN, { message: 'SKU ID无效' })
  @MaxLength(19, { message: 'SKU ID超出范围' })
  skuId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  // Optional for rolling-upgrade compatibility with cached miniprogram builds. The current client
  // always sends it and CartService uses it to make the incremental add operation retry-safe.
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Matches(CLIENT_REQUEST_ID, { message: '加购请求ID无效' })
  @MaxLength(54)
  clientRequestId?: string;
}
