import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateContentDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  categoryId?: number | null;

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: '标题不能为空' })
  title?: string;

  @IsOptional()
  @IsString()
  @IsIn(['article', 'video'], { message: '内容类型必须为 article 或 video' })
  contentType?: string;

  @IsOptional()
  @IsString()
  coverImage?: string | null;

  @IsOptional()
  @IsString({ message: '正文必须为字符串' })
  content?: string;

  @IsOptional()
  @IsString()
  summary?: string | null;

  @IsOptional()
  @IsString({ message: '视频地址必须为字符串' })
  videoUrl?: string | null;

  @IsOptional()
  @IsString()
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
  relatedProductIds?: number[] | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  relatedActivityId?: number | null;

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
