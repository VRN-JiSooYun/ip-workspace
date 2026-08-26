import { Transform } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";
import {
  PATENT_QUALITY_FILTER_KEYS,
  type PatentQualityFilter,
} from "../patent-quality";

/**
 * 진행 현황 집계와 목록이 공유하는 필터. 목록 조회 DTO가 이 DTO를 확장하므로
 * 여기에 항목을 추가하면 두 곳의 모집단이 함께 움직인다.
 */
export class PatentStageQueryDto {
  /**
   * 관리번호·출원번호·명칭·출원인을 한 번에 훑는 바로가기 검색(OR).
   *
   * 아래 컬럼별 조건과 함께 넘길 수 있고 서로 AND로 걸린다. "번호 일부는 아는데 어느
   * 컬럼인지 모르겠다"는 검색을 컬럼별 조건으로는 표현할 수 없어 둘 다 둔다.
   */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  // ---- 컬럼별 조건 --------------------------------------------------------
  // 목록 표의 각 열에 대응한다. 문자열 조건은 모두 대소문자 무시 부분 일치다.
  // 열을 늘리면 여기에도 같이 넣어야 한다(프런트 PatentListFilterValues와 1:1).

  /** 내부관리번호. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  internalRef?: string;

  /** 출원번호. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  applicationNumber?: string;

  /** 발명의 명칭. 국문·영문 어느 쪽이든 걸리면 통과시킨다. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  /** 출원인. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  applicant?: string;

  /** 등록번호. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  registrationNumber?: string;

  /** 대리인(attorney.attorney_number). */
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  attorneyNumber?: number;

  /** 출원일 시작(YYYY-MM-DD, 포함). */
  @IsOptional()
  @IsDateString()
  applicationDateFrom?: string;

  /** 출원일 끝(YYYY-MM-DD, 포함). */
  @IsOptional()
  @IsDateString()
  applicationDateTo?: string;

  /**
   * 문서(의견제출통지서) 유무. true면 한 건 이상 있는 것, false면 없는 것만 본다.
   *
   * query string은 값이 전부 문자열이라 "false"가 truthy가 된다. 그대로 두면 '없음'을
   * 고른 사용자가 '있음' 결과를 보게 되므로 명시적으로 옮긴다.
   */
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === "boolean") return value;
    if (value === "true") return true;
    if (value === "false") return false;
    return undefined;
  })
  @IsBoolean()
  hasDocuments?: boolean;

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

  /**
   * 세부 진행 단계(patent_stage.code). 대분류보다 좁은 조건이라 stageGroup과 함께
   * 넘기면 둘 다 AND로 걸린다. stageGroup과 마찬가지로 값은 검증하지 않는다.
   */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  stageCode?: string;

  /**
   * 데이터 품질 조건. 대시보드 품질 카드에서 목록으로 넘어올 때 쓴다.
   *
   * stageGroup/stageCode와 달리 값을 검증한다. 이쪽 조건은 DB의 코드 목록이 아니라
   * 서버가 정의한 고정 집합이고, 없는 값을 조용히 0건으로 만들면 링크 오타를
   * "해당 없음"으로 착각하게 된다.
   */
  @IsOptional()
  @IsIn(PATENT_QUALITY_FILTER_KEYS)
  quality?: PatentQualityFilter;
}
