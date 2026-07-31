import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class AdminConferenceAbstractListQueryDto {
  @IsOptional()
  @IsUUID('4')
  conferenceId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsIn(['active', 'deleted'])
  deleted: 'active' | 'deleted' = 'active';

  @IsOptional()
  @IsIn(['updatedDesc', 'abstractNumberAsc', 'dateOpenDesc'])
  sort: 'updatedDesc' | 'abstractNumberAsc' | 'dateOpenDesc' = 'updatedDesc';

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
