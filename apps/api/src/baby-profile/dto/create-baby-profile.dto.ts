import { Transform, Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;

export class CreateBabyProfileDto {
  @IsOptional() @Transform(trim) @IsString() @MaxLength(50) nickname?: string;
  @IsOptional() @Type(() => Number) @IsInt() @IsIn([0, 1, 2]) gender?: number;
  @IsDateString() @IsNotEmpty() birthday!: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(500) avatarUrl?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(500) avatar?: string;
  @IsOptional() @Type(() => Number) @IsInt() @IsIn([0, 1]) isDefault?: number;
}

export class UpdateBabyProfileDto {
  @IsOptional() @Transform(trim) @IsString() @MaxLength(50) nickname?: string;
  @IsOptional() @Type(() => Number) @IsInt() @IsIn([0, 1, 2]) gender?: number;
  @IsOptional() @IsDateString() birthday?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(500) avatarUrl?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(500) avatar?: string;
  @IsOptional() @Type(() => Number) @IsInt() @IsIn([0, 1]) isDefault?: number;
}
