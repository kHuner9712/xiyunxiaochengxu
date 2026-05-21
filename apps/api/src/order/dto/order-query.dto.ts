import { IsOptional, IsString, IsInt } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class OrderQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  orderNo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  startDate?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  endDate?: number;
}
