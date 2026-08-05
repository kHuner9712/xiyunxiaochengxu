import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateContentDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  categoryId?: number;

  @IsString()
  @IsNotEmpty({ message: '标题不能为空' })
  title!: string;

  @IsOptional()
  @IsString()
  @IsIn(['article', 'video'], { message: '内容类型必须为 article 或 video' })
  contentType?: string;

  @IsOptional()
  @IsString()
  coverImage?: string;

  @ValidateIf((dto: CreateContentDto) => dto.contentType !== 'video')
  @IsString({ message: '文章正文必须为字符串' })
  @IsNotEmpty({ message: '文章类型内容必须填写正文内容' })
  content?: string = '';

  @IsOptional()
  @IsString()
  summary?: string;

  @ValidateIf((dto: CreateContentDto) => dto.contentType === 'video')
  @IsString({ message: '视频地址必须为字符串' })
  @IsNotEmpty({ message: '视频类型内容必须上传视频文件' })
  videoUrl?: string;

  @IsOptional()
  @IsString()
  videoCover?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  videoDuration?: number;

  @IsOptional()
  placement?: any;

  @IsOptional()
  tags?: any;

  @IsOptional()
  relatedProductIds?: any;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  relatedActivityId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  isFeatured?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  status?: number;
}
