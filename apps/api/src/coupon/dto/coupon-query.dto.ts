import { IsArray, IsIn, IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { PaginationDto } from '../../common/dto/pagination.dto';

const POSITIVE_ID_PATTERN = /^[1-9]\d*$/;

function normalizeProductIds({ value }: { value: unknown }): string[] | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const values = Array.isArray(value) ? value : [value];
  return values
    .flatMap((item) => String(item).split(','))
    .map((item) => item.trim())
    .filter(Boolean);
}

export class CouponQueryDto extends PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([1, 2, 3])
  type?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([0, 1])
  status?: number;

  @IsOptional()
  @IsString()
  name?: string;
}

export class CouponListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;
}

export class UserCouponListQueryDto extends CouponListQueryDto {
  // This is a UI/display status, deliberately distinct from the DB enum:
  // 1 available, 2 used, 3 expired, 4 locked by a pending order.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([1, 2, 3, 4])
  status?: number;
}

export class UsableCouponQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  amount = 0;

  @IsOptional()
  @Transform(normalizeProductIds)
  @IsArray()
  @IsString({ each: true })
  @Matches(POSITIVE_ID_PATTERN, { each: true, message: '商品ID无效' })
  productIds: string[] = [];
}
