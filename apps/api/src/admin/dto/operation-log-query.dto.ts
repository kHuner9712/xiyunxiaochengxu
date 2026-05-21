import { IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class OperationLogQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  module?: string;

  @IsOptional()
  @IsString()
  adminUserId?: string;

  @IsOptional()
  @IsString()
  action?: string;
}
