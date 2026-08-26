import { Transform } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export const DEADLINE_DEFAULT_LIMIT = 100;
export const DEADLINE_MAX_LIMIT = 500;

/**
 * 대시보드 기한 보드용 범위 조회.
 *
 * 월 단위인 `PatentScheduleQueryDto`(캘린더)와 달리 임의 구간을 받는다. 월말에 붙은
 * 마감이 다음 달로 넘어가면 캘린더에서는 안 보이는데, 기한 보드는 "지금 급한 것"을
 * 보여 주는 화면이라 달 경계에서 끊기면 안 된다.
 */
export class PatentDeadlineQueryDto {
  /** 포함(inclusive). YYYY-MM-DD. */
  @IsISO8601()
  from!: string;

  /** 포함(inclusive). from보다 앞서면 0건이 된다. */
  @IsISO8601()
  to!: string;

  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  targets?: string[];

  /**
   * 돌려줄 항목 수 상한. 잘린 경우에도 `total`로 전체 건수를 함께 주므로
   * 화면이 "N건 더 보기"를 정확히 표시할 수 있다.
   */
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(DEADLINE_MAX_LIMIT)
  limit = DEADLINE_DEFAULT_LIMIT;
}
