import { Transform, Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

const MYSQL_SIGNED_INT_MAX = 2_147_483_647;
const BRAND_CREATE_REQUEST_ID = /^[1-9]\d{0,18}$/;

export class CreateBrandDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name!: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(500)
  logo?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MYSQL_SIGNED_INT_MAX)
  sortOrder?: number;

  // Optional only to keep rolling upgrades compatible with an already-cached admin bundle. The
  // current admin creates one stable id for every logical brand-create attempt.
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Matches(BRAND_CREATE_REQUEST_ID, { message: '品牌创建请求ID无效' })
  @MaxLength(19)
  clientRequestId?: string;
}
