import { Transform, Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { PointsQueryDto } from './points-query.dto';

const POSITIVE_ID = /^[1-9]\d*$/;
const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;

export class AdminPointsQueryDto extends PointsQueryDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Matches(POSITIVE_ID, { message: '用户ID格式无效' })
  userId?: string;
}

export class AdminAdjustPointsDto {
  @Transform(trim)
  @IsString()
  @Matches(POSITIVE_ID, { message: '用户ID格式无效' })
  userId!: string;

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
  description!: string;
}
