import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class ConferenceImportListQueryDto {
  @IsOptional()
  @Transform(({ value }) => value === undefined ? 30 : Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 30;
}
