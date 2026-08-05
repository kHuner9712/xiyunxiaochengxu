import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

const POSITIVE_ID_PATTERN = /^[1-9]\d*$/;

function normalizeOptionalId(value: unknown): unknown {
  if (value === undefined || value === null) return value;
  if (typeof value === 'number' && !Number.isSafeInteger(value)) {
    return '__unsafe_numeric_id__';
  }
  return String(value).trim();
}

export class UpdateContentDto {
  @IsOptional()
  @Transform(({ value }) => normalizeOptionalId(value))
  @IsString()
  @Matches(POSITIVE_ID_PATTERN, { message: '内容分类ID无效' })
  @MaxLength(19, { message: '内容分类ID超出范围' })
  categoryId?: string | null;

  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @IsNotEmpty({ message: '标题不能为空' })
  @MaxLength(200, { message: '标题不能超过200个字符' })
  title?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @IsIn(['article', 'video'], { message: '内容类型必须为 article 或 video' })
  contentType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: '封面地址不能超过500个字符' })
  coverImage?: string | null;

  @ValidateIf((_, value) => value !== undefined)
  @IsString({ message: '正文必须为字符串' })
  content?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: '摘要不能超过500个字符' })
  summary?: string | null;

  @IsOptional()
  @IsString({ message: '视频地址必须为字符串' })
  @MaxLength(500, { message: '视频地址不能超过500个字符' })
  videoUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: '视频封面地址不能超过500个字符' })
  videoCover?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  videoDuration?: number | null;

  @IsOptional()
  @IsArray()
  @IsIn(['activity', 'home', 'user_help'], { each: true })
  placement?: string[] | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  tags?: string[] | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(Number.MAX_SAFE_INTEGER, { each: true })
  relatedProductIds?: number[] | null;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalId(value))
  @IsString()
  @Matches(POSITIVE_ID_PATTERN, { message: '关联活动ID无效' })
  @MaxLength(19, { message: '关联活动ID超出范围' })
  relatedActivityId?: string | null;

  @ValidateIf((_, value) => value !== undefined)
  @Type(() => Number)
  @IsInt()
  @IsIn([0, 1])
  isFeatured?: number;

  @ValidateIf((_, value) => value !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ValidateIf((_, value) => value !== undefined)
  @Type(() => Number)
  @IsInt()
  @IsIn([1, 2])
  status?: number;
}
