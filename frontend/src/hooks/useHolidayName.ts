import { useCallback, useEffect, useState } from 'react';
import { holidayApi } from '../services/holidayApi';
import { getHolidayName as getLocalHolidayName } from '../utils/koreanHolidays';

/**
 * 달력에 칠할 공휴일 이름을 돌려준다.
 *
 * 백엔드(Google Calendar 중계)를 먼저 쓰고, 아직 못 받아온 연도나 실패한 연도는
 * 로컬 표(koreanHolidays.ts)로 폴백한다. 폴백이 있으므로 색이 사라지는 구간은 없다.
 * 연도별 결과는 모듈 수준에 캐시해 월 이동으로 재요청이 나가지 않게 한다.
 */
const yearCache = new Map<number, Map<string, string>>();
const failedYears = new Set<number>();
const inFlight = new Map<number, Promise<void>>();

const loadYear = (year: number): Promise<void> => {
  const existing = inFlight.get(year);
  if (existing) return existing;

  const request = holidayApi
    .findByYear(year)
    .then((result) => {
      // configured=false는 서버에 자격증명이 없다는 신호다. 오류로 다루지 않고 폴백한다.
      if (!result.configured || result.holidays.length === 0) {
        failedYears.add(year);
        return;
      }
      yearCache.set(
        year,
        new Map(result.holidays.map((holiday) => [holiday.date, holiday.name])),
      );
    })
    .catch(() => {
      failedYears.add(year);
    })
    .finally(() => {
      inFlight.delete(year);
    });

  inFlight.set(year, request);
  return request;
};

export const useHolidayName = (years: number[]) => {
  const [revision, setRevision] = useState(0);
  const yearKey = years.join(',');

  useEffect(() => {
    let active = true;
    const pending = years.filter(
      (year) => !yearCache.has(year) && !failedYears.has(year),
    );
    if (pending.length === 0) return;

    void Promise.all(pending.map(loadYear)).then(() => {
      // 결과가 캐시에 들어갔으므로 resolver를 새로 만들어 다시 그리게 한다.
      if (active) setRevision((current) => current + 1);
    });

    return () => {
      active = false;
    };
    // years 배열은 매 렌더 새로 만들어지므로 내용으로 비교한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yearKey]);

  return useCallback(
    (dateKey: string): string | undefined => {
      const year = Number(dateKey.slice(0, 4));
      const fromApi = yearCache.get(year);
      return fromApi ? fromApi.get(dateKey) : getLocalHolidayName(dateKey);
    },
    // revision이 바뀔 때만 새 함수가 필요하다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [revision],
  );
};
