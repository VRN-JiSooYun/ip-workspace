import { Transform } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

/**
 * 진행 현황 집계와 목록이 공유하는 필터. 목록 조회 DTO가 이 DTO를 확장하므로
 * 여기에 항목을 추가하면 두 곳의 모집단이 함께 움직인다.
 */
export class PatentStageQueryDto {
  /** 관리번호·출원번호·명칭·출원인 부분 일치 검색. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  /** 선택한 Target 중 하나와 정확히 일치하는 관리 특허만 조회한다. */
  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  targets?: string[];

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  countryId?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  legalStatusId?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  examStatusId?: number;

  /**
   * 진행 단계 대분류(patent_stage_group.code). 예약 값 `UNMAPPED`은 단계에 연결되지
   * 않은 건을 뜻한다. 코드 목록이 DB에서 늘어나므로 값 자체는 검증하지 않고,
   * 없는 코드를 넘기면 0건이 된다.
   */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  stageGroup?: string;
}
