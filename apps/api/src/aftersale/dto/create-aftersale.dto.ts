import { IsString, IsNotEmpty, IsOptional, IsArray, Matches, IsIn } from 'class-validator';

export class CreateAftersaleDto {
  @IsString()
  @Matches(/^\d+$/)
  @IsNotEmpty()
  orderItemId!: string;

  @IsIn([1, 2])
  type!: number;

  @IsString()
  @IsNotEmpty()
  reason!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  images?: string[];
}
