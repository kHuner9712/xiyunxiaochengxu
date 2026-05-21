import { IsString, IsNotEmpty } from 'class-validator';

export class ReturnLogisticsDto {
  @IsString()
  @IsNotEmpty()
  returnLogisticsCompany: string;

  @IsString()
  @IsNotEmpty()
  returnLogisticsNo: string;
}
