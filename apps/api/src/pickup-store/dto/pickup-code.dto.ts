import { IsString, Matches } from 'class-validator';

export class PickupCodeDto {
  @IsString()
  @Matches(/^\d{8}$/, { message: '自提码必须为8位数字' })
  pickupCode!: string;
}
