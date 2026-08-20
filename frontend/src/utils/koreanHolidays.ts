/**
 * 달력에 공휴일을 빨간색으로 표시하기 위한 대한민국 관공서 공휴일 계산.
 *
 * 양력 고정 공휴일은 규칙으로 계산하고, 음력 기반 공휴일(설날·추석·부처님오신날)은
 * 연도별 표로 관리한다. 음력 변환기를 프런트에 들이는 대신 표를 유지하는 쪽을 택했다.
 * LUNAR_BASED_HOLIDAYS 범위를 벗어난 연도는 음력 공휴일이 빠진 채 계산된다.
 */

/** 음력 기반 공휴일의 양력 기준일. 새 연도는 관보 확인 후 추가한다. */
const LUNAR_BASED_HOLIDAYS: Record<number, { seollal: string; chuseok: string; buddha: string }> = {
  2024: { seollal: '2024-02-10', chuseok: '2024-09-17', buddha: '2024-05-15' },
  2025: { seollal: '2025-01-29', chuseok: '2025-10-06', buddha: '2025-05-05' },
  2026: { seollal: '2026-02-17', chuseok: '2026-09-25', buddha: '2026-05-24' },
  2027: { seollal: '2027-02-07', chuseok: '2027-09-15', buddha: '2027-05-13' },
  2028: { seollal: '2028-01-27', chuseok: '2028-10-03', buddha: '2028-05-02' },
  2029: { seollal: '2029-02-13', chuseok: '2029-09-22', buddha: '2029-05-20' },
  2030: { seollal: '2030-02-03', chuseok: '2030-09-12', buddha: '2030-05-09' },
};

/** [월, 일, 이름]. 신정·현충일은 대체공휴일 대상이 아니다. */
const FIXED_HOLIDAYS: Array<[number, number, string, boolean]> = [
  [1, 1, '신정', false],
  [3, 1, '삼일절', true],
  [5, 5, '어린이날', true],
  [6, 6, '현충일', false],
  [8, 15, '광복절', true],
  [10, 3, '개천절', true],
  [10, 9, '한글날', true],
  [12, 25, '기독탄신일', true],
];

const toDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const fromDateKey = (value: string): Date => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const shiftDateKey = (value: string, offset: number): string => {
  const date = fromDateKey(value);
  date.setDate(date.getDate() + offset);
  return toDateKey(date);
};

type HolidaySeed = {
  date: string;
  name: string;
  /** 토·일 또는 다른 공휴일과 겹치면 대체공휴일이 생기는지 여부. */
  substitutable: boolean;
  /** 설날·추석 연휴는 일요일에만 대체공휴일이 붙는다. */
  sundayOnly: boolean;
};

const buildSeeds = (year: number): HolidaySeed[] => {
  const seeds: HolidaySeed[] = FIXED_HOLIDAYS.map(([month, day, name, substitutable]) => ({
    date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    name,
    substitutable,
    sundayOnly: false,
  }));

  const lunar = LUNAR_BASED_HOLIDAYS[year];
  if (lunar) {
    seeds.push({ date: lunar.buddha, name: '부처님오신날', substitutable: true, sundayOnly: false });
    [-1, 0, 1].forEach((offset) => {
      seeds.push({
        date: shiftDateKey(lunar.seollal, offset),
        name: '설날 연휴',
        substitutable: true,
        sundayOnly: true,
      });
      seeds.push({
        date: shiftDateKey(lunar.chuseok, offset),
        name: '추석 연휴',
        substitutable: true,
        sundayOnly: true,
      });
    });
  }

  return seeds.sort((a, b) => a.date.localeCompare(b.date));
};

/**
 * 대체공휴일 규칙: 대상 공휴일이 주말(설·추석 연휴는 일요일만) 또는 다른 공휴일과
 * 겹치면 그 뒤 첫 번째 비공휴일 평일을 대체공휴일로 지정한다.
 */
const buildHolidayMap = (year: number): Map<string, string> => {
  const seeds = buildSeeds(year);
  const holidays = new Map<string, string>();
  const substitutes: HolidaySeed[] = [];

  seeds.forEach((seed) => {
    const weekday = fromDateKey(seed.date).getDay();
    const overlaps = holidays.has(seed.date);
    const onWeekend = seed.sundayOnly ? weekday === 0 : weekday === 0 || weekday === 6;
    if (!holidays.has(seed.date)) holidays.set(seed.date, seed.name);
    if (seed.substitutable && (overlaps || onWeekend)) substitutes.push(seed);
  });

  substitutes.forEach((seed) => {
    let candidate = shiftDateKey(seed.date, 1);
    // 주말이거나 이미 공휴일인 날은 건너뛴다.
    while (holidays.has(candidate) || [0, 6].includes(fromDateKey(candidate).getDay())) {
      candidate = shiftDateKey(candidate, 1);
    }
    holidays.set(candidate, `대체공휴일(${seed.name})`);
  });

  return holidays;
};

const holidayCache = new Map<number, Map<string, string>>();

/** `YYYY-MM-DD` → 공휴일 이름 맵. 연도별로 한 번만 계산한다. */
export const getHolidayMap = (year: number): Map<string, string> => {
  const cached = holidayCache.get(year);
  if (cached) return cached;
  const computed = buildHolidayMap(year);
  holidayCache.set(year, computed);
  return computed;
};

/** 달력 그리드는 앞뒤 달을 물기 때문에 연도가 걸치는 구간도 함께 조회한다. */
export const getHolidayName = (dateKey: string): string | undefined => {
  const year = Number(dateKey.slice(0, 4));
  if (!Number.isFinite(year)) return undefined;
  return getHolidayMap(year).get(dateKey);
};
