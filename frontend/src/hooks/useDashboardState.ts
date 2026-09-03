import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccessContext } from '../contexts/AccessContext';
import { useAuthSession } from '../contexts/AuthSessionContext';
import { calendarEventApi, type CalendarEventGateway } from '../services/calendarEventApi';
import { useHolidayName } from './useHolidayName';
import {
  patentRecordApi,
  type PatentDeadlineItem,
  type PatentDeadlineResult,
  type PatentQualityFilter,
  type PatentStageSummary,
  type PatentSummary,
  type PatentTargetSummary,
} from '../services/patentRecordApi';
import { shiftDateKey, toLocalDateKey } from '../utils/patentCalendar';
import type { CalendarEventPatent } from '../utils/calendarEvents';
import { buildPatentListQuery } from '../utils/patentListQueryParams';
import type { DeadlineBucketKey } from '../components/dashboard/widgets/DeadlineBoard';
import type { KpiTile } from '../components/dashboard/widgets/KpiStrip';

/** 기한 보드가 보는 구간. 지연 건도 함께 봐야 하므로 과거 쪽으로 넉넉히 잡는다. */
const DEADLINE_PAST_DAYS = 365;
const DEADLINE_FUTURE_DAYS = 30;
const DEADLINE_LIMIT = 100;

/** 특허 관리 화면. routes.tsx의 실제 경로다(/patents/manage는 placeholder다). */
const PATENT_MANAGEMENT_PATH = '/patent-management';

/** 일정에 연결할 특허를 고를 때 한 번에 보여 줄 후보 수. 고르는 자리라 한 화면치면 된다. */
const PATENT_OPTION_PAGE_SIZE = 20;
const PATENT_CODE_ADMIN_PATH = '/workspace/patent-code-admin';

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';

/**
 * 대시보드 상태 전부.
 *
 * 위젯들은 트리 어느 자리에든 독립적으로 마운트되므로 props로 내려보낼 공통 부모가 없다.
 * usePatentWorkspaceState와 같은 이유로 상태를 한 곳에 모아 컨텍스트로 내려 준다.
 *
 * 요약(summary)과 기한(deadlines)은 각각 한 번만 부른다. 위젯마다 따로 부르면 첫 렌더에
 * 요청이 여러 번 나가고, 화면 안에서 숫자가 서로 다른 시점을 보게 된다.
 */
export const useDashboardState = () => {
  const navigate = useNavigate();
  const session = useAuthSession();
  const { access, hasPermission } = useAccessContext();
  const canRead = hasPermission('patentAnalysis.read');
  const canManage = hasPermission('patentAnalysis.manage');

  // ---- 공통 필터 ----
  const [targets, setTargets] = useState<PatentTargetSummary[]>([]);
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);

  // ---- 데이터 ----
  const [summary, setSummary] = useState<PatentSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState('');

  const [deadlines, setDeadlines] = useState<PatentDeadlineResult | null>(null);
  const [deadlinesLoading, setDeadlinesLoading] = useState(false);
  const [deadlinesError, setDeadlinesError] = useState('');

  const [stageSummary, setStageSummary] = useState<PatentStageSummary | null>(null);
  const [stagesLoading, setStagesLoading] = useState(false);
  const [stagesError, setStagesError] = useState('');

  /** KPI 마감 타일을 눌렀을 때 기한 보드에서 강조할 버킷. */
  const [focusedBucket, setFocusedBucket] = useState<DeadlineBucketKey | null>(null);

  const targetFilter = useMemo(
    () => (selectedTargets.length > 0 ? selectedTargets : undefined),
    [selectedTargets],
  );

  // ---- 조회 ----------------------------------------------------------------

  const loadSummary = useCallback(async () => {
    if (!canRead) return;
    setSummaryLoading(true);
    setSummaryError('');
    try {
      setSummary(await patentRecordApi.summary({ targets: targetFilter }));
    } catch (error) {
      setSummary(null);
      setSummaryError(getErrorMessage(error));
    } finally {
      setSummaryLoading(false);
    }
  }, [canRead, targetFilter]);

  const loadDeadlines = useCallback(async () => {
    if (!canRead) return;
    setDeadlinesLoading(true);
    setDeadlinesError('');
    try {
      const today = toLocalDateKey(new Date());
      setDeadlines(await patentRecordApi.deadlines({
        from: shiftDateKey(today, -DEADLINE_PAST_DAYS),
        to: shiftDateKey(today, DEADLINE_FUTURE_DAYS),
        targets: targetFilter,
        limit: DEADLINE_LIMIT,
      }));
    } catch (error) {
      setDeadlines(null);
      setDeadlinesError(getErrorMessage(error));
    } finally {
      setDeadlinesLoading(false);
    }
  }, [canRead, targetFilter]);

  const loadStages = useCallback(async () => {
    if (!canRead) return;
    setStagesLoading(true);
    setStagesError('');
    try {
      setStageSummary(await patentRecordApi.stages({ targets: targetFilter }));
    } catch (error) {
      setStageSummary(null);
      setStagesError(getErrorMessage(error));
    } finally {
      setStagesLoading(false);
    }
  }, [canRead, targetFilter]);

  /**
   * 일정 위젯이 쓰는 저장소. 여기서 한 번 고정해 두는 이유는 조회 훅이 이 값의 정체성으로
   * 다시 부를지를 정하기 때문이다(매 렌더 새 객체면 끝없이 다시 부른다).
   */
  const calendarGateway = useMemo<CalendarEventGateway>(() => ({
    list: calendarEventApi.list,
    create: calendarEventApi.create,
    update: calendarEventApi.update,
    remove: calendarEventApi.remove,
  }), []);

  /**
   * 일정 위젯이 달력에 겹쳐 그릴 특허 일정. 달 단위 조회라 화면이 보이는 달만 부른다.
   *
   * 다른 조회와 달리 여기서 상태로 들고 있지 않는다. 어느 달을 보고 있는지는 달력이
   * 알고, 그 캐시도 달력 쪽 훅(usePatentScheduleEvents)이 갖기 때문이다.
   */
  const loadPatentScheduleEvents = useCallback(async (year: number, month: number) => {
    const result = await patentRecordApi.schedule({ year, month, targets: targetFilter });
    return result.events;
  }, [targetFilter]);

  /**
   * 일정 등록 모달의 '관련 특허' 고르기.
   *
   * 목록 조회를 그대로 쓴다(관리번호·출원번호·명칭·출원인을 한 번에 훑는 조건이 이미
   * 있다). 고르는 자리라 한 화면치만 받고, 검색어가 없으면 최근 등록순 앞쪽을 준다.
   */
  const searchPatentOptions = useCallback(async (
    keyword: string,
  ): Promise<CalendarEventPatent[]> => {
    const result = await patentRecordApi.list({
      q: keyword.trim() || undefined,
      sort: 'idDesc',
      page: 1,
      pageSize: PATENT_OPTION_PAGE_SIZE,
    });
    return result.items.map((item) => ({
      id: item.id,
      internalRef: item.internalRef,
      applicationNumber: item.applicationNumber,
      title: item.koreanTitle ?? item.englishTitle ?? null,
    }));
  }, []);

  const loadTargets = useCallback(async () => {
    if (!canRead) return;
    try {
      const result = await patentRecordApi.targets();
      setTargets(result);
      // 사라진 Target은 선택에서도 제거한다(특허 관리와 같은 처리).
      const available = new Set(result.map((item) => item.target));
      setSelectedTargets((current) => current.filter((target) => available.has(target)));
    } catch {
      setTargets([]);
    }
  }, [canRead]);

  useEffect(() => { void loadTargets(); }, [loadTargets]);
  useEffect(() => { void loadSummary(); }, [loadSummary]);
  useEffect(() => { void loadDeadlines(); }, [loadDeadlines]);
  useEffect(() => { void loadStages(); }, [loadStages]);

  /**
   * 머리글의 새로고침이 눌린 횟수.
   *
   * 일정 위젯은 자기 조회를 스스로 한다(보이는 기간이 바뀔 때). 그래도 사용자가 새로고침을
   * 누르면 함께 다시 불러야 하므로, 목록 대신 신호만 이렇게 흘려 준다.
   */
  const [refreshToken, setRefreshToken] = useState(0);

  const refresh = useCallback(() => {
    void loadSummary();
    void loadDeadlines();
    void loadStages();
    setRefreshToken((current) => current + 1);
  }, [loadDeadlines, loadStages, loadSummary]);

  // ---- 공휴일(영업일 보정) -------------------------------------------------

  /**
   * 기한 보드가 걸치는 연도. 과거 1년 ~ 미래 30일이라 연말·연초에는 두(또는 세) 해가 된다.
   */
  const deadlineYears = useMemo(() => {
    const today = new Date();
    const years = new Set<number>([today.getFullYear()]);
    years.add(Number(shiftDateKey(toLocalDateKey(today), -DEADLINE_PAST_DAYS).slice(0, 4)));
    years.add(Number(shiftDateKey(toLocalDateKey(today), DEADLINE_FUTURE_DAYS).slice(0, 4)));
    return [...years].sort();
  }, []);
  const getHolidayName = useHolidayName(deadlineYears);

  // ---- 이동 ---------------------------------------------------------------

  const openPatentList = useCallback((seed: Parameters<typeof buildPatentListQuery>[0]) => {
    navigate(`${PATENT_MANAGEMENT_PATH}${buildPatentListQuery({
      ...seed,
      // 대시보드에서 좁혀 보던 Target을 목록에서도 유지한다.
      targets: seed.targets ?? selectedTargets,
    })}`);
  }, [navigate, selectedTargets]);

  /** KPI 타일의 `to`는 이미 전체 경로다. 그대로 이동한다. */
  const navigateTo = useCallback((to: string) => {
    navigate(to);
  }, [navigate]);

  const openCodeAdmin = useCallback(() => {
    navigate(PATENT_CODE_ADMIN_PATH);
  }, [navigate]);

  const openQualityList = useCallback((quality: PatentQualityFilter) => {
    openPatentList({ quality });
  }, [openPatentList]);

  /**
   * 마감 관련 KPI 타일은 목록으로 딥링크하지 않는다. 목록 API에 마감일 범위 필터가 없어
   * 링크로 표현할 조건이 없기 때문이다. 대신 같은 화면의 기한 보드로 시선을 옮긴다.
   */
  const focusDeadlineBucket = useCallback((bucket: string) => {
    setFocusedBucket(bucket as DeadlineBucketKey);
    if (typeof document === 'undefined') return;
    document
      .getElementById(`db-deadline-bucket-${bucket}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const openDeadline = useCallback((item: PatentDeadlineItem) => {
    // 특허 한 건으로 좁혀서 목록을 연다. 통합 검색(q)이 아니라 상세 검색의 출원번호
    // 조건으로 건다 — 그래야 넘어간 화면에서 무엇이 걸렸는지 보이고 해제할 수 있다.
    openPatentList({ applicationNumber: item.applicationNumber, targets: [] });
  }, [openPatentList]);

  // ---- KPI 타일 -----------------------------------------------------------

  const kpiTiles = useMemo<KpiTile[]>(() => {
    const counts = summary?.deadlines;
    return [
      {
        key: 'total',
        label: '관리 특허',
        value: summary?.total ?? 0,
        tone: 'neutral',
        to: `${PATENT_MANAGEMENT_PATH}${buildPatentListQuery({ targets: selectedTargets })}`,
      },
      {
        key: 'overdue',
        label: '일정 지연',
        value: counts?.overdue ?? 0,
        tone: 'danger',
        focusBucket: 'overdue',
      },
      {
        key: 'today',
        label: '오늘 마감',
        value: counts?.today ?? 0,
        tone: 'warn',
        focusBucket: 'today',
      },
      {
        key: 'within7',
        label: '7일 내 마감',
        value: counts?.within7 ?? 0,
        tone: 'warn',
        focusBucket: 'within7',
      },
      {
        key: 'awaitingRegistration',
        label: '등록 대기',
        value: summary?.awaitingRegistration ?? 0,
        tone: 'neutral',
        to: `${PATENT_MANAGEMENT_PATH}${buildPatentListQuery({
          stageCode: 'ALLOWANCE',
          targets: selectedTargets,
        })}`,
      },
      {
        key: 'expiringWithinYear',
        label: '만료 임박 (1년)',
        value: summary?.expiringWithinYear ?? 0,
        tone: 'neutral',
      },
    ];
  }, [selectedTargets, summary]);

  const toggleTarget = useCallback((target: string) => {
    setSelectedTargets((current) => (
      current.includes(target)
        ? current.filter((item) => item !== target)
        : [...current, target]
    ));
  }, []);

  return {
    /** 배치 저장을 사용자별로 나누는 데 쓴다. */
    userId: session.user.id,
    /** 일정의 공개 범위(팀 공개)를 고를 때 쓴다. */
    teams: access.teams,
    calendarGateway,
    canRead,
    canManage,

    targets,
    selectedTargets,
    setSelectedTargets,
    toggleTarget,

    summary,
    summaryLoading,
    summaryError,

    deadlines,
    deadlinesLoading,
    deadlinesError,

    stageSummary,
    stagesLoading,
    stagesError,

    focusedBucket,
    focusDeadlineBucket,

    kpiTiles,
    loadPatentScheduleEvents,
    searchPatentOptions,
    refreshToken,
    navigateTo,
    getHolidayName,
    refresh,

    openPatentList,
    openQualityList,
    openCodeAdmin,
    openDeadline,
  };
};

export type DashboardState = ReturnType<typeof useDashboardState>;
