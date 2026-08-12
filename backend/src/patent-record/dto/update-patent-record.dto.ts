import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

/**
 * 전달된 field만 갱신한다. null을 보내면 해당 column을 비운다.
 * `patent` table에는 updatedAt이 없어 낙관적 잠금은 걸지 않는다.
 */
export class UpdatePatentRecordDto {
  @IsOptional()
  @IsInt()
  countryId?: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  applicationNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  internalRef?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  koreanTitle?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  englishTitle?: string | null;

  @IsOptional()
  @IsDateString()
  applicationDate?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  applicant?: string | null;

  @IsOptional()
  @IsInt()
  attorneyNumber?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  registrationNumber?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  registrationDate?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  publicationNumber?: string | null;

  @IsOptional()
  @IsDateString()
  publicationDate?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  intApplicationNumber?: string | null;

  @IsOptional()
  @IsDateString()
  intApplicationDate?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  intPublicationNumber?: string | null;

  @IsOptional()
  @IsDateString()
  intPublicationDate?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  parentApplicationNumber?: string | null;

  @IsOptional()
  @IsInt()
  legalStatusId?: number | null;

  @IsOptional()
  @IsInt()
  examStatusId?: number | null;

  @IsOptional()
  @IsBoolean()
  exam?: boolean | null;

  @IsOptional()
  @IsDateString()
  examDate?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  target?: string | null;
}
