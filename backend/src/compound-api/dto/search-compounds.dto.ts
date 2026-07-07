import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SearchCompoundsDto {
  @IsString()
  @IsNotEmpty()
  login_token!: string;

  @IsString()
  @IsOptional()
  query?: string;
}
