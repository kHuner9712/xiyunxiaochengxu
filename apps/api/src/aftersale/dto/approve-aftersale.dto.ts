import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class ApproveAftersaleDto {
  @Type(() => Number)
  @IsInt({ message: '退款金额必须是整数分' })
  @Min(1, { message: '退款金额必须大于0分' })
  refundAmount!: number;
}
