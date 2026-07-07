import { ArrayNotEmpty, IsArray, IsNotEmpty, IsString } from 'class-validator';

export class GetCompoundSarDataDto {
  @IsString()
  @IsNotEmpty()
  login_token!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  compounds!: string[];
}
