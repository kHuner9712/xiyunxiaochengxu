import { IsOptional, IsInt, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class CouponQueryDto extends PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  type?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  status?: number;

  @IsOptional()
  @IsString()
  name?: string;
}
