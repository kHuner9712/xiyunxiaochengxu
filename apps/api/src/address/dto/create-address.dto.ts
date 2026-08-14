import { Transform } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const PHONE_PATTERN = /^[0-9+()\-\s]{6,20}$/;
const CLIENT_REQUEST_ID = /^\d{13}-[a-z0-9]{16,40}$/i;

export class CreateAddressDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  receiverName?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Matches(PHONE_PATTERN, { message: '收货人联系电话格式无效' })
  @MaxLength(20)
  receiverPhone?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Matches(PHONE_PATTERN, { message: '收货人联系电话格式无效' })
  @MaxLength(20)
  phone?: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  province!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  city!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  district!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  detailAddress?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  detail?: string;

  @IsOptional()
  @Transform(({ value }) => (value === true || value === 1 || value === '1' ? 1 : 0))
  @IsIn([0, 1])
  isDefault?: number;

  // Optional only for rolling-upgrade compatibility with cached miniprogram builds. The current
  // client always sends it and create() uses it as the durable weak-network operation identity.
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Matches(CLIENT_REQUEST_ID, { message: '地址创建请求ID无效' })
  @MaxLength(54)
  clientRequestId?: string;
}
