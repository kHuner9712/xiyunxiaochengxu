import { IsString, IsNotEmpty } from 'class-validator';

export class WeappLoginDto {
  @IsString()
  @IsNotEmpty()
  code: string;
}
