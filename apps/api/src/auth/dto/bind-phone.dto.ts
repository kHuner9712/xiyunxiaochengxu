import { IsString, IsNotEmpty } from 'class-validator';

export class BindPhoneDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  encryptedData!: string;

  @IsString()
  @IsNotEmpty()
  iv!: string;
}
