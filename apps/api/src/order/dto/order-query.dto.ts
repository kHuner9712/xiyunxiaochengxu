import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { OrderStatus } from '@prisma/client';

export class OrderQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @IsIn(Object.values(OrderStatus))
  status?: string;

  @IsOptional()
  @IsString()
  orderNo?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsString()
  @IsIn(['delivery', 'pickup'])
  fulfillmentType?: string;
}
