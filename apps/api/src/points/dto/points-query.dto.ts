import { IsOptional, IsInt, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class PointsQueryDto extends PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  type?: number;

  @IsOptional()
  @IsString()
  source?: string;
}
