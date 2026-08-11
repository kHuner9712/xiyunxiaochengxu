import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateAftersaleDto {
  @IsString()
  @Matches(/^\d+$/)
  @IsNotEmpty()
  orderId!: string;

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
  @ArrayMaxSize(6)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(128, { each: true })
  @Matches(/^\/api\/common\/file\/private\/[1-9]\d*$/, { each: true })
  images?: string[];
}
