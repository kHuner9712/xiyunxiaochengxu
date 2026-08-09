import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class SaveRecommendationItemDto {
  @IsString()
  @Matches(/^[1-9]\d*$/, { message: '推荐目标ID格式无效' })
  targetId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(9999)
  sort!: number;
}

export class SaveRecommendationItemsDto {
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique((item: SaveRecommendationItemDto) => item?.targetId)
  @ValidateNested({ each: true })
  @Type(() => SaveRecommendationItemDto)
  items!: SaveRecommendationItemDto[];
}
