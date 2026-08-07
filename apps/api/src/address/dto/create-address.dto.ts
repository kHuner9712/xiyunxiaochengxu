import { Transform } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const PHONE_PATTERN = /^[0-9+()\-\s]{6,20}$/;

export class CreateAddressDto {
  @ValidateIf((o) => !o.name)
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: '收货人姓名不能为空' })
  @MaxLength(50)
  receiverName?: string;

  @ValidateIf((o) => !o.receiverName)
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: '收货人姓名不能为空' })
  @MaxLength(50)
  name?: string;

  @ValidateIf((o) => !o.phone)
  @Transform(trim)
  @IsString()
  @Matches(PHONE_PATTERN, { message: '收货人联系电话格式无效' })
  @MaxLength(20)
  receiverPhone?: string;

  @ValidateIf((o) => !o.receiverPhone)
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

  @ValidateIf((o) => !o.detail)
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: '详细地址不能为空' })
  @MaxLength(200)
  detailAddress?: string;

  @ValidateIf((o) => !o.detailAddress)
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: '详细地址不能为空' })
  @MaxLength(200)
  detail?: string;

  @IsOptional()
  @Transform(({ value }) => (value === true || value === 1 || value === '1' ? 1 : 0))
  @IsIn([0, 1])
  isDefault?: number;
}