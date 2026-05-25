import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateAddressDto {
  @IsOptional()
  @IsString()
  receiverName?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  receiverPhone?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsString()
  @IsNotEmpty()
  province!: string;

  @IsString()
  @IsNotEmpty()
  city!: string;

  @IsString()
  @IsNotEmpty()
  district!: string;

  @IsOptional()
  @IsString()
  detailAddress?: string;

  @IsOptional()
  @IsString()
  detail?: string;

  @IsOptional()
  @Transform(({ value }) => (value === true || value === 1 ? 1 : 0))
  isDefault?: number;
}
