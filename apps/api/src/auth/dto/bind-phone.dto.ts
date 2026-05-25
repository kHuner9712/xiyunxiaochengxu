import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class BindPhoneDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsOptional()
  encryptedData?: string;

  @IsString()
  @IsOptional()
  iv?: string;
}
