import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class ApproveAftersaleDto {
  @Type(() => Number)
  @IsInt({ message: '退款金额必须是整数分' })
  @Min(0, { message: '退款金额不能小于0分' })
  refundAmount!: number;
}
