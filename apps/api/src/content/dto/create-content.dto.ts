import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
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

function normalizeIdArray(value: unknown): unknown {
  if (value === undefined || value === null) return value;
  if (!Array.isArray(value)) return value;
  return value.map((item) => typeof item === 'string' ? item.trim() : '__invalid_numeric_id__');
}

export class CreateContentDto {
  @IsOptional()
  @Transform(({ value }) => normalizeOptionalId(value))
  @IsString()
  @Matches(POSITIVE_ID_PATTERN, { message: '内容分类ID无效' })
  @MaxLength(19, { message: '内容分类ID超出范围' })
  categoryId?: string | null;

  @IsString()
  @IsNotEmpty({ message: '标题不能为空' })
  @MaxLength(200, { message: '标题不能超过200个字符' })
  title!: string;

  @IsOptional()
  @IsString()
  @IsIn(['article', 'video'], { message: '内容类型必须为 article 或 video' })
  contentType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: '封面地址不能超过500个字符' })
  coverImage?: string | null;

  @ValidateIf((dto: CreateContentDto) => dto.contentType !== 'video')
  @IsString({ message: '文章正文必须为字符串' })
  @IsNotEmpty({ message: '文章类型内容必须填写正文内容' })
  content?: string = '';

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: '摘要不能超过500个字符' })
  summary?: string | null;

  @ValidateIf((dto: CreateContentDto) => dto.contentType === 'video')
  @IsString({ message: '视频地址必须为字符串' })
  @IsNotEmpty({ message: '视频类型内容必须上传视频文件' })
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
  @Transform(({ value }) => normalizeIdArray(value))
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @Matches(POSITIVE_ID_PATTERN, { each: true, message: '关联商品ID无效' })
  @MaxLength(19, { each: true, message: '关联商品ID超出范围' })
  relatedProductIds?: string[] | null;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalId(value))
  @IsString()
  @Matches(POSITIVE_ID_PATTERN, { message: '关联活动ID无效' })
  @MaxLength(19, { message: '关联活动ID超出范围' })
  relatedActivityId?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([0, 1])
  isFeatured?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([1, 2])
  status?: number;
}
