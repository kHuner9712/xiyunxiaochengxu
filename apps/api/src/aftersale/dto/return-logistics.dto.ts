import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class ReturnLogisticsDto {
  @IsString()
  @IsNotEmpty()
  returnLogisticsCompany!: string;

  @IsString()
  @IsNotEmpty()
  returnLogisticsNo!: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsString()
  remark?: string;
}
