import {
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateAdminConferenceAbstractDto {
  @IsOptional()
  @IsUUID('4')
  conferenceId?: string;

  @IsOptional()
  @IsDateString()
  expectedUpdatedAt?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  sourceUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  firstAuthorName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  firstAuthorOrganization?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  authors?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  meeting?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  sessionType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  sessionTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  track?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  subTrack?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  abstractNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  posterNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  clinicalTrialRegistrationNumber?: string;

  @IsOptional()
  @IsDateString()
  dateOpen?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100_000)
  contentsJson?: string;
}
