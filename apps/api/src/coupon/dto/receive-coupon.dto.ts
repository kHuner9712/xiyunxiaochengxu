import { IsString, Matches, MaxLength } from 'class-validator';

const CLIENT_REQUEST_ID_PATTERN = /^\d{13}-[a-z0-9]{16,40}$/i;

export class ReceiveCouponDto {
  @IsString()
  @Matches(CLIENT_REQUEST_ID_PATTERN, { message: '领取请求标识无效' })
  @MaxLength(54, { message: '领取请求标识过长' })
  clientRequestId!: string;
}
