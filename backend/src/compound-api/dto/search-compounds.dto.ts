import { IsOptional, IsString } from 'class-validator';

export class SearchCompoundsDto {
  @IsString()
  @IsOptional()
  query?: string;
}
