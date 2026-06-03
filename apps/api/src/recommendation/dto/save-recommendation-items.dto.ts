import { IsArray } from 'class-validator';

export class SaveRecommendationItemsDto {
  @IsArray()
  items!: any[];
}
