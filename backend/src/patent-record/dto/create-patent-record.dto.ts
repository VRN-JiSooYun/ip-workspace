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
 * `patent` table 기준. NOT NULL인 country와 application_number만 필수이고
 * 나머지는 등록·공개 전까지 비어 있는 것이 정상이라 모두 optional이다.
 */
export class CreatePatentRecordDto {
  @IsInt()
  countryId!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  applicationNumber!: string;

  /** IP팀 내부관리번호. 1단계에서는 형식을 강제하지 않는다. */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  internalRef?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  koreanTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  englishTitle?: string;

  @IsOptional()
  @IsDateString()
  applicationDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  applicant?: string;

  @IsOptional()
  @IsInt()
  attorneyNumber?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  registrationNumber?: string;

  /** ERD상 text column이라 날짜 형식을 강제하지 않는다. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  registrationDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  publicationNumber?: string;

  @IsOptional()
  @IsDateString()
  publicationDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  intApplicationNumber?: string;

  @IsOptional()
  @IsDateString()
  intApplicationDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  intPublicationNumber?: string;

  @IsOptional()
  @IsDateString()
  intPublicationDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  parentApplicationNumber?: string;

  @IsOptional()
  @IsInt()
  legalStatusId?: number;

  @IsOptional()
  @IsInt()
  examStatusId?: number;

  @IsOptional()
  @IsBoolean()
  exam?: boolean;

  @IsOptional()
  @IsDateString()
  examDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  target?: string;
}
