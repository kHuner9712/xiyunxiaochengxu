import { IsString, IsNotEmpty, IsOptional, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateBabyProfileDto {
  @IsOptional()
  @IsString()
  nickname?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  gender?: number;

  @IsString()
  @IsNotEmpty()
  birthday!: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  isDefault?: number;
}
