import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, MaxLength, Max, Min } from 'class-validator';

const POSITIVE_ID = /^[1-9]\d*$/;
const CLIENT_REQUEST_ID_PATTERN = /^\d{13}-[a-z0-9]{16,40}$/i;
const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;

export class ActivityCheckoutDto {
  // Preview uses the same DTO and therefore may omit the request identity. The create-order path
  // requires it explicitly in the idempotent production checkout service.
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Matches(CLIENT_REQUEST_ID_PATTERN, { message: '下单请求标识无效' })
  @MaxLength(54, { message: '下单请求标识过长' })
  clientRequestId?: string;

  @Transform(trim)
  @IsString()
  @Matches(POSITIVE_ID, { message: '活动商品ID无效' })
  activityProductId!: string;

  @Transform(trim)
  @IsString()
  @Matches(POSITIVE_ID, { message: 'SKU ID无效' })
  skuId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(99)
  quantity!: number;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Matches(POSITIVE_ID, { message: '收货地址ID无效' })
  addressId?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Matches(POSITIVE_ID, { message: '自提点ID无效' })
  pickupStoreId?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsIn(['delivery', 'pickup'])
  fulfillmentType?: 'delivery' | 'pickup';

  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsIn(['direct', 'user_referral', 'merchant_referral', 'campaign'])
  sourceType?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  sourceCode?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Matches(POSITIVE_ID, { message: '推荐人用户ID无效' })
  referrerUserId?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  remark?: string;
}
