import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const POSITIVE_ID = /^[1-9]\d*$/;

export class UpdateAdminUserDto {
  @IsOptional() @IsString() @MaxLength(50) realName?: string;
  @IsOptional() @IsString() @MaxLength(20) phone?: string;
  @IsOptional() @IsString() @MaxLength(500) avatar?: string;
  @IsOptional() @IsString() @MinLength(8) @MaxLength(100) password?: string;
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @Matches(POSITIVE_ID, { each: true, message: '角色ID无效' })
  roleIds?: string[];
  @IsOptional() @Type(() => Number) @IsInt() @IsIn([0, 1]) status?: number;
}

export class AdminUserStatusDto {
  @Type(() => Number) @IsInt() @IsIn([0, 1]) status!: number;
}

export class UpdateRoleDto {
  @IsOptional() @IsString() @MaxLength(50) name?: string;
  @IsOptional() @IsString() @MaxLength(200) description?: string;
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @Matches(POSITIVE_ID, { each: true, message: '权限ID无效' })
  permissionIds?: string[];
}
