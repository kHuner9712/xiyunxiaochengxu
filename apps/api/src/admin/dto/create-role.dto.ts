import {
  ArrayNotEmpty,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

const POSITIVE_ID = /^[1-9]\d*$/;
const ROLE_CODE = /^[a-z][a-z0-9_]{1,49}$/;

export class CreateRoleDto {
  @IsString() @IsNotEmpty() @MaxLength(50) name!: string;
  @IsString() @Matches(ROLE_CODE, { message: '角色编码只能使用小写字母、数字和下划线' }) code!: string;
  @IsOptional() @IsString() @MaxLength(200) description?: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @Matches(POSITIVE_ID, { each: true, message: '权限ID无效' })
  permissionIds!: string[];
}
