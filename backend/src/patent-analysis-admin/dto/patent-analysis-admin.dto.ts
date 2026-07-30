import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const PATENT_ADMIN_STATUSES = [
  'request',
  'analysis',
  'bioactivity fail',
  'bioactivity_fail',
  'no compound',
  'no_compound',
  'complete',
  'modified complete',
  'modified_complete',
  'error',
] as const;

export class AdminPatentListQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page = 1;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  pageSize = 30;

  @IsOptional() @IsString() @MaxLength(200)
  keyword?: string;

  @IsOptional()
  @IsIn(PATENT_ADMIN_STATUSES)
  status?: string;

  @IsOptional() @Transform(({ value }) => value === true || value === 'true')
  requestOnly?: boolean;

  @IsOptional() @IsIn(['date_created', 'date_updated', 'publication_date', 'status'])
  sortField = 'date_updated';

  @IsOptional() @IsIn(['asc', 'desc'])
  sortOrder: 'asc' | 'desc' = 'desc';
}

export class ModifyAdminPatentDto {
  @IsOptional() @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  publicationDate?: string;

  @IsOptional() @IsArray() @IsString({ each: true })
  @MaxLength(200, { each: true })
  targets?: string[];

  @IsOptional() @IsString() @MaxLength(500)
  applicant?: string;

  @IsOptional() @IsString()
  @IsIn(PATENT_ADMIN_STATUSES)
  status?: string;

  @IsOptional() @IsString() @MaxLength(4000)
  comment?: string;
}

export class CreateBioactivityRequestDto {
  @IsOptional() @Type(() => Number) @IsInt()
  @IsIn([0, 30, 50, 70, 100])
  quality = 0;
}

export class CreatePatentTargetRequestDto {
  @IsString() @MaxLength(200)
  targetName!: string;

  @IsOptional() @IsArray() @IsString({ each: true })
  @MaxLength(200, { each: true })
  keywords: string[] = [];
}

export class PatentTargetDecisionDto {
  @IsOptional() @IsString() @MaxLength(200)
  targetName?: string;

  @IsOptional() @IsArray() @IsString({ each: true })
  @MaxLength(200, { each: true })
  keywords?: string[];
}

export class PatentTargetListQueryDto {
  @IsOptional() @IsIn(['PENDING', 'ACTIVE'])
  status: 'PENDING' | 'ACTIVE' = 'PENDING';
}
