import { Transform } from 'class-transformer';
import { IsDateString, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationDto } from './pagination.dto';

const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;

export class BusinessEventQueryDto extends PaginationDto {
  @IsOptional() @Transform(trim) @IsString() @IsIn(['info', 'warning', 'error', 'critical']) level?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(50) bizType?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(100) eventType?: string;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
}
