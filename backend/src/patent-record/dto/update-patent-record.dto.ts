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

  /**
   * 설명. 화면의 WYSIWYG 편집기가 보내는 HTML 조각이다(태그는 화면이 저장 전에 한 번,
   * 다시 그릴 때 한 번 더 걸러 낸다).
   *
   * `note`는 TEXT 컬럼이라 이 상한은 DB 제약이 아니라 사고 방지용이다. 목록 조회가
   * 행의 scalar를 전부 돌려주므로 **설명이 길어지면 목록 응답이 함께 무거워진다** —
   * 그래서 편집기에서 이미지를 아예 받지 않고(글자만), 상한도 서식 포함 2만 자로 둔다.
   */
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  note?: string | null;
}
