import { IsString, IsNotEmpty, IsOptional, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateMemberLevelDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  id?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  minGrowthValue?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  maxGrowthValue?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  discountRate?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  pointsRate?: number;

  @IsOptional()
  @IsString()
  benefits?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}
