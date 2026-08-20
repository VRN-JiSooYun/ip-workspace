import { DEFAULT_API_BASE_PATH } from '../config/basePath';
import { notifyIfAuthRequired } from './authApi';

type RuntimeWindow = Window & { _env_?: { VITE_API_URL?: string } };

export type Holiday = {
  /** `YYYY-MM-DD` */
  date: string;
  name: string;
  /** 어느 캘린더에서 왔는지. 공휴일과 사내 휴무를 구분해야 할 때 쓴다. */
  calendarId: string;
};

export type HolidayYearResult = {
  year: number;
  /** false면 서버에 자격증명이 없다는 뜻이다. 오류가 아니므로 조용히 폴백한다. */
  configured: boolean;
  holidays: Holiday[];
};

const getApiBaseUrl = () => {
  const runtimeValue = typeof window !== 'undefined'
    ? (window as RuntimeWindow)._env_?.VITE_API_URL
    : undefined;
  const value = runtimeValue || import.meta.env.VITE_API_URL || DEFAULT_API_BASE_PATH;
  return value.includes('${') ? DEFAULT_API_BASE_PATH : value.replace(/\/$/, '');
};

export const holidayApi = {
  async findByYear(year: number, signal?: AbortSignal): Promise<HolidayYearResult> {
    const response = await fetch(
      new URL(`${getApiBaseUrl()}/holidays?year=${year}`, window.location.origin).toString(),
      { credentials: 'include', signal },
    );
    notifyIfAuthRequired(response);
    if (!response.ok) throw new Error(`HOLIDAY_API_${response.status}`);
    return (await response.json()) as HolidayYearResult;
  },
};
