import { IsOptional, IsString, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  nickname?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  avatar?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  gender?: number;
}
