import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

/**
 * 기간 조건을 걸 수 있는 날짜 column.
 *
 * 외부 API는 `registration_date`도 받지만 그 column이 timestamp가 아닌 text라
 * (`patent.registration_date`, Prisma에서도 `String?`) 비교 시 항상 500으로 실패한다
 * (`operator does not exist: text >= timestamp without time zone`). 성공할 수 없는
 * 선택지라 여기서 제외했다. 외부에서 column type이 고쳐지면 다시 넣으면 된다.
 */
export const PATENT_SEARCH_DATE_FIELDS = [
  "applicationDate",
  "publicationDate",
  "intApplicationDate",
  "intPublicationDate",
  "examDate",
] as const;

export type PatentSearchDateField = (typeof PATENT_SEARCH_DATE_FIELDS)[number];

/**
 * 검색 대상 문서.
 * - `officeAction` 의견제출통지서
 * - `opinion` 의견서
 * - `amendment` 보정서
 */
export const PATENT_SEARCH_KEYWORD_TARGETS = [
  "officeAction",
  "opinion",
  "amendment",
] as const;

export type PatentSearchKeywordTarget =
  (typeof PATENT_SEARCH_KEYWORD_TARGETS)[number];

export const PATENT_SEARCH_KEYWORD_OPERATORS = ["AND", "OR", "NOT"] as const;

export type PatentSearchKeywordOperator =
  (typeof PATENT_SEARCH_KEYWORD_OPERATORS)[number];

export class PatentSearchDateRangeDto {
  @IsIn(PATENT_SEARCH_DATE_FIELDS)
  field!: PatentSearchDateField;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

export class PatentSearchIpcDto {
  @IsOptional()
  @IsString()
  @MaxLength(10)
  section?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  classCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  subclass?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  mainGroup?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  subgroup?: string;
}

export class PatentSearchStatuteDto {
  /** 법종류. `legal_statutes.law_type` 코드(int) 또는 명칭 문자열("특허법") 둘 다 받는다. */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  lawTypeText?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  lawType?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  article?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  paragraph?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  subParagraph?: number;
}

/**
 * 문서 전문(full-text) 키워드 조건.
 *
 * 외부 API는 `targets`를 배열로 받지만 2개 이상을 넘기면 500(`index should have a
 * `WITH (key_field='...')` option`)으로 실패한다. 여러 문서를 함께 조건에 넣으려면
 * target 하나짜리 항목을 여러 개 보내야 하므로(항목 간에는 AND) 여기서는 배열이 아닌
 * `target` 하나만 받는다. 상세는 `docs/patent_search_api.md` 참고.
 */
export class PatentSearchKeywordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  query!: string;

  @IsIn(PATENT_SEARCH_KEYWORD_TARGETS)
  target!: PatentSearchKeywordTarget;

  @IsOptional()
  @IsIn(PATENT_SEARCH_KEYWORD_OPERATORS)
  operator: PatentSearchKeywordOperator = "AND";
}

export class PatentSearchFiltersDto {
  /** `legal_status.status` 원문. 예: ["등록", "공개"] */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  legalStatusText?: string[];

  /** `exam_status.status` 원문. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  examStatusText?: string[];

  /** `patent.exam` — 심사청구 여부. */
  @IsOptional()
  @IsBoolean()
  examRequested?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  attorneyNames?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  examinerNames?: string[];

  /** 의견서가 제출된 OA만. */
  @IsOptional()
  @IsBoolean()
  hasOpinion?: boolean;

  /** 보정서가 제출된 OA만. */
  @IsOptional()
  @IsBoolean()
  hasAmendment?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => PatentSearchIpcDto)
  ipc?: PatentSearchIpcDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => PatentSearchStatuteDto)
  statutes?: PatentSearchStatuteDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => PatentSearchDateRangeDto)
  dateRanges?: PatentSearchDateRangeDto[];
}

export class PatentSearchDto {
  /**
   * 1부터 시작한다. 외부 API는 0을 넘기면 OFFSET이 음수가 되어 500으로 실패하므로
   * 여기서 막는다.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  /** OA 본문이 건당 10KB를 넘어 100건이면 응답이 2MB를 넘는다. 그래서 100으로 제한한다. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  size = 20;

  /**
   * false면 OA·의견서·보정서 본문을 응답에서 뺀다(`contentLength`만 남는다).
   * 목록 화면처럼 본문이 필요 없는 경우 응답 크기를 크게 줄일 수 있다.
   */
  @IsOptional()
  @IsBoolean()
  includeContent = true;

  /**
   * true면 각 결과에 `patent` 상세(출원일자·공개번호·등록번호 등)를 붙인다.
   *
   * 검색 응답에 없는 column이라 결과의 출원번호마다 `GET /patents/`를 한 번 더 부른다
   * (중복 제거 후 병렬, 20건 기준 0.2초 내). 필요 없는 호출자에게 비용을 지우지 않으려고
   * 기본값은 false다.
   */
  @IsOptional()
  @IsBoolean()
  includePatentDetail = false;

  @IsOptional()
  @ValidateNested()
  @Type(() => PatentSearchFiltersDto)
  filters?: PatentSearchFiltersDto;

  /** 항목이 여러 개면 서로 AND로 묶인다. */
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => PatentSearchKeywordDto)
  keywords?: PatentSearchKeywordDto[];
}
