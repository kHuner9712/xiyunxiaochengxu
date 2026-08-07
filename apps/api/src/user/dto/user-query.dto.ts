import { IsIn, IsOptional, IsString, IsInt, Matches } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { PaginationDto } from '../../common/dto/pagination.dto';

const POSITIVE_ID = /^[1-9]\d*$/;
const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;

export class UserQueryDto extends PaginationDto {
  @IsOptional() @Transform(trim) @IsString() keyword?: string;
  @IsOptional() @Transform(trim) @IsString() nickname?: string;
  @IsOptional() @Transform(trim) @IsString() phone?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Matches(POSITIVE_ID, { message: '会员等级ID无效' })
  memberLevel?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Matches(POSITIVE_ID, { message: '会员等级ID无效' })
  memberLevelId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([0, 1])
  status?: number;
}
