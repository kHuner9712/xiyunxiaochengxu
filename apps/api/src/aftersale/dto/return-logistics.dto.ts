import { IsString, IsNotEmpty, IsOptional, MaxLength, Matches } from 'class-validator';

const RETURN_CONTACT_PHONE_OR_EMPTY = /^(?:|[0-9+()\-.\s]{5,40})$/;

export class ReturnLogisticsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  returnLogisticsCompany!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  returnLogisticsNo!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Matches(RETURN_CONTACT_PHONE_OR_EMPTY, { message: '联系电话格式无效' })
  contactPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}
