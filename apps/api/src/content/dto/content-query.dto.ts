import { IsOptional, IsInt, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class ContentQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  status?: number;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  contentType?: string;

  @IsOptional()
  @IsString()
  placement?: string;

  @IsOptional()
  @IsString()
  keyword?: string;
}
