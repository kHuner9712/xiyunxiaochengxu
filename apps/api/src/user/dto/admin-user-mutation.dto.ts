import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, Min, Max } from 'class-validator';

const POSITIVE_ID = /^[1-9]\d*$/;
const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;

export class AdjustMemberLevelDto {
  @Transform(trim)
  @IsString()
  @Matches(POSITIVE_ID, { message: '会员等级ID无效' })
  memberLevelId!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  reason?: string;
}

export class AdjustUserPointsDto {
  @Transform(trim)
  @IsString()
  @Matches(POSITIVE_ID, { message: '积分调整请求ID无效' })
  @MaxLength(19)
  requestId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2147483647)
  expectedAvailablePoints!: number;

  @Type(() => Number)
  @IsInt()
  @Min(-100000000)
  @Max(100000000)
  points!: number;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  reason!: string;
}

export class UpdateUserStatusDto {
  @Type(() => Number)
  @IsInt()
  @IsIn([0, 1])
  status!: number;
}
