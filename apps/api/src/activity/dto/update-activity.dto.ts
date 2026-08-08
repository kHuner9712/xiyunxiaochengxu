import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ActivityProductDto } from './create-activity.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';

const EXPLICIT_TIMEZONE = /(?:Z|[+-]\d{2}:\d{2})$/i;
const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;

export class UpdateActivityDto {
  @IsOptional() @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(100) name?: string;
  @IsOptional() @Transform(trim) @IsString() @IsIn(['1', '2', '3', '4', '5']) type?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(5000) description?: string;
  @IsOptional() @IsObject() rules?: Record<string, unknown>;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(500) bannerImage?: string;

  @IsOptional()
  @IsString()
  @IsISO8601({}, { message: '活动开始时间必须为ISO 8601时间' })
  @Matches(EXPLICIT_TIMEZONE, { message: '活动开始时间必须包含明确时区' })
  startTime?: string;

  @IsOptional()
  @IsString()
  @IsISO8601({}, { message: '活动结束时间必须为ISO 8601时间' })
  @Matches(EXPLICIT_TIMEZONE, { message: '活动结束时间必须包含明确时区' })
  endTime?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ActivityProductDto)
  products?: ActivityProductDto[];
}

export class ActivityStatusDto {
  @Type(() => Number)
  @IsInt()
  @IsIn([0, 1, 2])
  status!: number;
}

export class AddActivityProductDto extends ActivityProductDto {}

export class ActivityFeedQueryDto extends PaginationDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsIn(['recommend', 'discount', 'video', 'article'])
  tab = 'recommend';
}
