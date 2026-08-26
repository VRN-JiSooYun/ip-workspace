import { useCallback, useEffect, useRef, useState } from 'react';
import type { PatentScheduleEvent } from '../services/patentRecordApi';

export type PatentScheduleLoader = (
  year: number,
  month: number,
) => Promise<PatentScheduleEvent[]>;

export type PatentScheduleState = {
  events: PatentScheduleEvent[];
  loading: boolean;
  error: string;
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';

/**
 * 달력에 겹쳐 보여 줄 특허 일정.
 *
 * 서버 조회가 **달 단위**라(`/patent-record/schedule?year&month`) 화면에 보이는 날짜가
 * 걸치는 달들을 받아 그 달만 부른다. 월 격자는 앞뒤 달의 며칠을 함께 보여 주므로 보통
 * 두세 달, 주간은 한두 달, 일간은 한 달이다.
 *
 * 한 번 부른 달은 다시 부르지 않는다. 달을 앞뒤로 넘겨 보는 것이 이 화면의 기본 동작이라,
 * 캐시가 없으면 왔다 갔다 할 때마다 같은 요청이 나간다. 조건(Target 등)이 바뀌면
 * `resetKey`로 캐시를 통째로 버린다.
 */
export const usePatentScheduleEvents = (
  load: PatentScheduleLoader,
  months: string[],
  resetKey: string,
): PatentScheduleState => {
  const [byMonth, setByMonth] = useState<Record<string, PatentScheduleEvent[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  /** 이미 부르는 중이거나 부른 달. 같은 달을 두 번 부르지 않기 위한 표식이다. */
  const requested = useRef(new Set<string>());
  const monthsKey = months.join(',');

  useEffect(() => {
    requested.current = new Set();
    setByMonth({});
    setError('');
  }, [resetKey]);

  useEffect(() => {
    const wanted = monthsKey ? monthsKey.split(',') : [];
    const missing = wanted.filter((month) => !requested.current.has(month));
    if (missing.length === 0) return;
    for (const month of missing) requested.current.add(month);

    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const loaded = await Promise.all(missing.map(async (key) => {
          const [year, month] = key.split('-').map(Number);
          return [key, await load(year, month)] as const;
        }));
        if (cancelled) return;
        setByMonth((current) => ({ ...current, ...Object.fromEntries(loaded) }));
        setError('');
      } catch (failure) {
        if (cancelled) return;
        // 실패한 달은 표식에서 지운다. 다시 그 달을 보면 한 번 더 시도한다.
        for (const month of missing) requested.current.delete(month);
        setError(getErrorMessage(failure));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [load, monthsKey, resetKey]);

  const collect = useCallback(() => {
    const wanted = monthsKey ? monthsKey.split(',') : [];
    return wanted.flatMap((month) => byMonth[month] ?? []);
  }, [byMonth, monthsKey]);

  return { events: collect(), loading, error };
};
