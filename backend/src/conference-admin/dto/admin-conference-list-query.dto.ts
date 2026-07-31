import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class AdminConferenceListQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1900)
  @Max(2200)
  year?: number;

  @IsOptional()
  @IsIn(['OPEN', 'NOT_OPENED'])
  status?: 'OPEN' | 'NOT_OPENED';

  @IsOptional()
  @IsIn(['active', 'deleted'])
  deleted: 'active' | 'deleted' = 'active';

  @IsOptional()
  @IsIn(['yearDesc', 'yearAsc', 'updatedDesc'])
  sort: 'yearDesc' | 'yearAsc' | 'updatedDesc' = 'yearDesc';

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 10;
}
