import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';

export class ApproveAftersaleDto {
  @Type(() => Number)
  @IsInt({ message: '退款金额必须是整数分' })
  @Min(0, { message: '退款金额不能小于0分' })
  refundAmount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(50, { message: '退货收件人不能超过50个字符' })
  returnReceiverName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30, { message: '退货联系电话不能超过30个字符' })
  @Matches(/^[0-9+()\-\s]{6,30}$/, { message: '退货联系电话格式无效' })
  returnReceiverPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: '退货地址不能超过500个字符' })
  returnAddress?: string;
}
