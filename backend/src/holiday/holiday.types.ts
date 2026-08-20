export type Holiday = {
  /** `YYYY-MM-DD` (Asia/Seoul 기준 종일 일정의 날짜). */
  date: string;
  name: string;
  /** 어느 캘린더에서 왔는지. 공휴일과 사내 휴무를 구분해야 할 때 쓴다. */
  calendarId: string;
};

export type HolidayYearResult = {
  year: number;
  /**
   * 자격증명이 설정되어 있는지. false면 상위(프런트)가 자체 폴백을 쓰라는 신호다.
   * 자격증명이 없는 것은 오류가 아니라 의도된 상태이므로 200으로 내려준다.
   */
  configured: boolean;
  holidays: Holiday[];
};

/** Google Calendar API events.list 응답 중 실제로 쓰는 부분만. */
export type GoogleCalendarEvent = {
  summary?: string;
  description?: string;
  status?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
};

export type GoogleCalendarEventsResponse = {
  items?: GoogleCalendarEvent[];
  nextPageToken?: string;
};
