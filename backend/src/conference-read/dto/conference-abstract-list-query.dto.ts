import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const optionalBoolean = ({ value }: { value: unknown }) => {
  if (value === undefined || value === '') return undefined;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return value;
};

export class ConferenceAbstractListQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @Transform(optionalBoolean)
  @IsBoolean()
  favoriteOnly?: boolean;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @Transform(optionalBoolean)
  @IsBoolean()
  hasPoster?: boolean;

  @IsOptional()
  @Transform(optionalBoolean)
  @IsBoolean()
  hasVideo?: boolean;

  @IsOptional()
  @Transform(optionalBoolean)
  @IsBoolean()
  hasDocument?: boolean;

  @IsOptional()
  @IsIn(['abstractNumberAsc', 'titleAsc', 'dateOpenDesc', 'commentCountDesc'])
  sort: 'abstractNumberAsc' | 'titleAsc' | 'dateOpenDesc' | 'commentCountDesc' = 'abstractNumberAsc';

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
  pageSize = 30;
}
