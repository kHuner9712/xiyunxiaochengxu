import { IsOptional, IsString, IsInt } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class UserQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsString()
  nickname?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  memberLevel?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  memberLevelId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  status?: number;
}
