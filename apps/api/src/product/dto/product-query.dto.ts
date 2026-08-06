import { IsOptional, IsString, IsInt, Matches } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../common/dto/pagination.dto';

type EntityId = string | number;

export class ProductQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: '分类ID格式不正确' })
  categoryId?: EntityId;

  @IsOptional()
  @IsString()
  sort?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: '商品ID格式不正确' })
  productId?: EntityId;

  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: '品牌ID格式不正确' })
  brandId?: EntityId;

  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: '供应商ID格式不正确' })
  supplierId?: EntityId;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  status?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  isRecommend?: number;
}
