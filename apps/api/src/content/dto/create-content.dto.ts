import { IsString, IsNotEmpty, IsOptional, IsInt, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateContentDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  categoryId?: number;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsOptional()
  @IsString()
  contentType?: string;

  @IsOptional()
  @IsString()
  coverImage?: string;

  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsString()
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
