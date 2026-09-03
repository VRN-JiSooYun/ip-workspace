import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

/** 화면이 쓰는 색 표식. frontend `CALENDAR_EVENT_COLORS`와 같은 목록이어야 한다. */
export const CALENDAR_EVENT_COLORS = [
  "purple",
  "orange",
  "yellow",
  "teal",
  "blue",
  "red",
] as const;

export const CALENDAR_EVENT_VISIBILITIES = ["PRIVATE", "TEAM"] as const;

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const TIME_VALUE = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CalendarEventQueryDto {
  @Matches(DATE_KEY, { message: "from must be YYYY-MM-DD" })
  from!: string;

  @Matches(DATE_KEY, { message: "to must be YYYY-MM-DD" })
  to!: string;
}

export class CreateCalendarEventDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  title!: string;

  @Matches(DATE_KEY, { message: "start must be YYYY-MM-DD" })
  start!: string;

  /** 종료일은 그날을 포함한다. */
  @Matches(DATE_KEY, { message: "end must be YYYY-MM-DD" })
  end!: string;

  @IsBoolean()
  allDay!: boolean;

  /** 종일이 아니면 둘 다 있어야 한다(service에서 함께 본다). */
  @IsOptional()
  @Matches(TIME_VALUE, { message: "startTime must be HH:mm" })
  startTime?: string | null;

  @IsOptional()
  @Matches(TIME_VALUE, { message: "endTime must be HH:mm" })
  endTime?: string | null;

  @IsIn(CALENDAR_EVENT_COLORS)
  color!: (typeof CALENDAR_EVENT_COLORS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(300)
  memo?: string | null;

  @IsIn(CALENDAR_EVENT_VISIBILITIES)
  visibility!: (typeof CALENDAR_EVENT_VISIBILITIES)[number];

  /** visibility가 TEAM일 때만 쓴다. 내가 속한 팀이어야 한다. */
  @IsOptional()
  @IsString()
  teamId?: string | null;

  /**
   * 연결할 관리 특허(patent.id). 선택 사항이며 null이면 연결을 끊는다.
   * 내부관리번호가 아니라 id로 받는다 — 내부관리번호는 나중에 고쳐질 수 있는 표기다.
   */
  @IsOptional()
  @IsInt()
  @IsPositive()
  patentId?: number | null;
}

/**
 * 수정은 전체 교체다.
 *
 * 일정의 값들은 서로 얽혀 있다(종일이면 시각이 없어야 하고, 팀 공개면 팀이 있어야 한다).
 * 필드별 부분 수정을 받으면 "기존 값 + 새 값"의 조합마다 그 규칙을 다시 따져야 해서,
 * 폼이 통째로 보내는 지금 방식이 규칙을 한 곳에서 지키기 쉽다.
 */
export class UpdateCalendarEventDto extends CreateCalendarEventDto {}
