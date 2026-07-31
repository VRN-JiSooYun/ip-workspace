import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateAdminConferenceDto {
  @IsOptional()
  @IsDateString()
  expectedUpdatedAt?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  abbreviation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  fullTitle?: string;

  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;

  @IsOptional()
  @IsIn(['OPEN', 'NOT_OPENED'])
  status?: 'OPEN' | 'NOT_OPENED';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  sourceUrl?: string;

  @IsOptional()
  @IsDateString()
  dateStart?: string | null;

  @IsOptional()
  @IsDateString()
  dateEnd?: string | null;
}
