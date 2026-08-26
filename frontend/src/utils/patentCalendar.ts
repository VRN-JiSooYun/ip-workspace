/**
 * 특허 관리 화면의 날짜 계산. 일정 패널과 To-do 패널이 함께 쓴다.
 *
 * 전부 로컬 시간대 기준이다. Date를 UTC로 다루면 자정 근처에서 하루가 밀려
 * 마감일이 어긋나 보인다(D-1이 D-Day로 보이는 식).
 */

export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export const toLocalDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const parseDateKey = (value: string): Date => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
};

/** 오늘 0시를 기준으로 남은 날. 음수면 이미 지났다. */
export const calendarDayDifference = (dateKey: string): number => {
  const dueDate = parseDateKey(dateKey);
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((dueDate.getTime() - todayStart.getTime()) / 86_400_000);
};

export const ddayLabel = (daysLeft: number): string => {
  if (daysLeft === 0) return 'D-Day';
  return daysLeft > 0 ? `D-${daysLeft}` : `D+${Math.abs(daysLeft)}`;
};

export const ddayClassName = (daysLeft: number): string => {
  if (daysLeft <= 3) return 'pm-dday pm-dday-urgent';
  if (daysLeft <= 7) return 'pm-dday pm-dday-soon';
  return 'pm-dday pm-dday-later';
};

export const shiftDateKey = (value: string, offset: number): string => {
  const date = parseDateKey(value);
  date.setDate(date.getDate() + offset);
  return toLocalDateKey(date);
};

/**
 * 마감일이 주말·공휴일이면 실제로 처리할 수 있는 다음 영업일을 돌려준다.
 * 이미 영업일이면 null이다(호출하는 쪽에서 "보정 없음"으로 다룬다).
 *
 * 공휴일 판정은 한국 기준만 있다(백엔드 `/api/holidays`에 국가 파라미터가 없다).
 * 그래서 국내 건에만 쓰고, 해외 건은 역일 그대로 보여 준 뒤 그 사실을 화면에서 구분한다.
 *
 * maxLookahead는 연휴가 길어도 끝나긴 한다는 안전장치다. 넘어가면 null을 돌려
 * 보정을 포기한다(잘못된 날짜를 자신 있게 보여 주는 것보다 낫다).
 */
export const nextBusinessDay = (
  dateKey: string,
  isHoliday: (dateKey: string) => boolean,
  maxLookahead = 14,
): string | null => {
  const isNonBusiness = (key: string): boolean => {
    const weekday = parseDateKey(key).getDay();
    return weekday === 0 || weekday === 6 || isHoliday(key);
  };

  if (!isNonBusiness(dateKey)) return null;

  let cursor = dateKey;
  for (let step = 0; step < maxLookahead; step += 1) {
    cursor = shiftDateKey(cursor, 1);
    if (!isNonBusiness(cursor)) return cursor;
  }
  return null;
};

export type MonthGridCell = {
  day: number;
  date: string;
  inMonth: boolean;
};

/** 대상 월의 날짜를 앞뒤 달로 채워 주 단위로 맞춘 격자. */
export const buildMonthGrid = (year: number, month: number): MonthGridCell[] => {
  const firstOfMonth = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const leading = firstOfMonth.getDay();
  const cellCount = Math.ceil((leading + daysInMonth) / 7) * 7;
  return Array.from({ length: cellCount }, (_, index) => {
    const date = new Date(year, month - 1, index - leading + 1);
    return {
      day: date.getDate(),
      date: toLocalDateKey(date),
      inMonth: date.getMonth() === month - 1,
    };
  });
};
