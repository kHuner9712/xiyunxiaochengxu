import { IsString, MaxLength } from 'class-validator';

export class AdminRemarkDto {
  @IsString()
  @MaxLength(500, { message: '订单备注不能超过500个字符' })
  remark!: string;
}
