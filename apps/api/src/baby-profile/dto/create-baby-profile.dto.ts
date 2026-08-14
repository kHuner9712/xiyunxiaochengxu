import { Transform, Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;
const CLIENT_REQUEST_ID = /^\d{13}-[a-z0-9]{16,40}$/i;

export class CreateBabyProfileDto {
  @IsOptional() @Transform(trim) @IsString() @MaxLength(50) nickname?: string;
  @IsOptional() @Type(() => Number) @IsInt() @IsIn([0, 1, 2]) gender?: number;
  @IsDateString() @IsNotEmpty() birthday!: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(500) avatarUrl?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(500) avatar?: string;
  @IsOptional() @Type(() => Number) @IsInt() @IsIn([0, 1]) isDefault?: number;

  // Optional for rolling-upgrade compatibility with already cached miniprogram builds. The current
  // client always sends it; when present it gives create() durable weak-network idempotency.
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Matches(CLIENT_REQUEST_ID, { message: '宝宝档案创建请求ID无效' })
  @MaxLength(54)
  clientRequestId?: string;
}

export class UpdateBabyProfileDto {
  @IsOptional() @Transform(trim) @IsString() @MaxLength(50) nickname?: string;
  @IsOptional() @Type(() => Number) @IsInt() @IsIn([0, 1, 2]) gender?: number;
  @IsOptional() @IsDateString() birthday?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(500) avatarUrl?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(500) avatar?: string;
  @IsOptional() @Type(() => Number) @IsInt() @IsIn([0, 1]) isDefault?: number;
}
