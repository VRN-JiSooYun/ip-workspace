import { Transform } from 'class-transformer';
import { IsInt, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class RecipientSearchQueryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  q!: string;

  @Transform(({ value }) => value === undefined ? 10 : Number(value))
  @IsInt()
  @Min(1)
  @Max(20)
  limit = 10;
}
