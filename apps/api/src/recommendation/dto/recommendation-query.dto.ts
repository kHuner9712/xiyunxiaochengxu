import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class RecommendationQueryDto extends PaginationDto {}

export class RecommendationCandidateQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  keyword?: string;
}
