import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  App as AntApp,
  Button,
  Checkbox,
  Input,
  Pagination,
  Popover,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import type { TableColumnsType } from 'antd';
import {
  Archive,
  ArrowUpDown,
  Award,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CircleDashed,
  ClipboardList,
  FileCheck,
  Gavel,
  ListTodo,
  Pencil,
  Plus,
  Reply,
  Search,
  Send,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import PageHeaderBreadcrumb from '../components/common/PageHeaderBreadcrumb';
import PatentCsvImportModal from '../components/patent-management/PatentCsvImportModal';
import PatentRecordFormModal from '../components/patent-management/PatentRecordFormModal';
import PatentSearchBar from '../components/patent-management/PatentSearchBar';
import PatentTodoModal from '../components/patent-management/PatentTodoModal';
import { useAccessContext } from '../contexts/AccessContext';
import {
  patentRecordApi,
  UNMAPPED_STAGE_GROUP,
  type CreatePatentRecordInput,
  type PatentRecord,
  type PatentRecordLookups,
  type PatentScheduleEvent,
  type PatentScheduleResult,
  type PatentStageSummary,
  type PatentTargetSummary,
} from '../services/patentRecordApi';
import { useUIStore } from '../store/useUIStore';
import { useHolidayName } from '../hooks/useHolidayName';
import { formatDisplayDateOnly, formatNumberWithComma } from '../utils/displayFormat';
import './PatentManagement.css';

const { Text } = Typography;

const PAGE_SIZE = 20;

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';

const emptyDash = (value: string | null | undefined) => value ?? '-';

/**
 * 검색어와 일치한 구간을 <mark>로 감싼다. 서버가 대소문자 구분 없이 부분 일치로 찾으므로
 * (patent-record.service의 contains + insensitive) 화면도 같은 규칙으로 자른다.
 * 일치가 없으면 원본 문자열을 그대로 돌려주므로 불필요한 DOM이 늘지 않는다.
 */
const highlightMatch = (
  value: string | null | undefined,
  keyword: string,
): React.ReactNode => {
  const needle = keyword.trim();
  if (!value || !needle) return value ?? null;

  const haystack = value.toLocaleLowerCase();
  const target = needle.toLocaleLowerCase();
  const parts: React.ReactNode[] = [];
  let from = 0;

  for (let at = haystack.indexOf(target); at !== -1; at = haystack.indexOf(target, from)) {
    if (at > from) parts.push(value.slice(from, at));
    parts.push(
      <mark key={at} className="pm-highlight">{value.slice(at, at + needle.length)}</mark>,
    );
    from = at + needle.length;
  }

  if (parts.length === 0) return value;
  if (from < value.length) parts.push(value.slice(from));
  return parts;
};

/**
 * 특허 관리 — compound-driven patent portfolio view.
 *
 * 관리 특허 목록은 `/api/patent-records`(로컬 `patent` table)만 본다. 추가·변경·삭제
 * 대상이 이 table이다.
 *
 * 예전에는 `/api/patent-search`(외부 문서 전문 검색)를 토글로 함께 보여주고 행을 누르면
 * 오른쪽 문서 뷰어를 띄웠다. 문서 검색은 의견제출통지서 화면(`OfficeActionAnalysis`)으로
 * 일원화해서 여기서는 뺐다.
 *
 * 진행 단계 pipeline·일정·To-do·Target 모두 로컬 DB를 조회한다.
 */

/**
 * 단계 대분류(patent_stage_group.code)별 아이콘. 라벨·순서·건수는 DB가 정본이고
 * 아이콘만 화면이 갖는다. 새 group이 생기면 여기에 없더라도 기본 아이콘으로 그린다.
 */
const STAGE_GROUP_ICONS: Record<string, React.ReactNode> = {
  PREP: <ClipboardList size={18} />,
  FILED: <Send size={18} />,
  EXAM: <Gavel size={18} />,
  RESPONSE: <Reply size={18} />,
  REG: <Award size={18} />,
  CLOSED: <Archive size={18} />,
  ETC: <FileCheck size={18} />,
};

const stageGroupIcon = (code: string): React.ReactNode =>
  STAGE_GROUP_ICONS[code] ?? <CircleDashed size={18} />;

type StageTile = {
  code: string;
  label: string;
  count: number;
  icon: React.ReactNode;
  /** 미분류처럼 목록 위에 설명이 필요한 경우에만 채운다. */
  note?: string;
  rows: { key: string; label: string; scope: string | null; count: number }[];
};

/**
 * 단계 타일 hover 내용. 줄바꿈 문자열 tooltip은 정렬이 안 맞아 읽기 어려워서
 * 라벨·국가·건수를 grid로 세운다.
 */
const renderStageDetail = (tile: StageTile, isActive: boolean): React.ReactNode => (
  <div className="pm-stage-detail">
    <div className="pm-stage-detail-head">
      <span className="pm-stage-detail-title">{tile.label}</span>
      <span
        className={`pm-stage-detail-total${tile.count === 0 ? ' pm-stage-detail-total-empty' : ''}`}
      >
        {formatNumberWithComma(tile.count)}건
      </span>
    </div>

    {tile.note && <p className="pm-stage-detail-note">{tile.note}</p>}

    {tile.rows.length > 0 ? (
      <ul className="pm-stage-detail-list">
        {tile.rows.map((row) => (
          <li
            key={row.key}
            className={`pm-stage-detail-row${row.count === 0 ? ' pm-stage-detail-row-empty' : ''}`}
          >
            <span className="pm-stage-detail-label">{row.label}</span>
            {row.scope && <span className="pm-stage-detail-scope">{row.scope}</span>}
            <span className="pm-stage-detail-count">{formatNumberWithComma(row.count)}</span>
          </li>
        ))}
      </ul>
    ) : (
      <p className="pm-stage-detail-note">세부 단계가 없습니다.</p>
    )}

    {/* <p className="pm-stage-detail-hint">
      {isActive ? '다시 누르면 필터를 해제합니다.' : '누르면 목록을 이 단계로 필터링합니다.'}
    </p> */}
  </div>
);

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const toLocalDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateKey = (value: string): Date => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const calendarDayDifference = (dateKey: string): number => {
  const dueDate = parseDateKey(dateKey);
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((dueDate.getTime() - todayStart.getTime()) / 86_400_000);
};

const ddayLabel = (daysLeft: number): string => {
  if (daysLeft === 0) return 'D-Day';
  return daysLeft > 0 ? `D-${daysLeft}` : `D+${Math.abs(daysLeft)}`;
};

const ddayClassName = (daysLeft: number): string => {
  if (daysLeft <= 3) return 'pm-dday pm-dday-urgent';
  if (daysLeft <= 7) return 'pm-dday pm-dday-soon';
  return 'pm-dday pm-dday-later';
};

/** Days of the target month padded to whole weeks with neighbouring days. */
const buildMonthGrid = (year: number, month: number) => {
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

const PatentManagement: React.FC = () => {
  const { setHeaderContent } = useUIStore();
  const [targets, setTargets] = useState<PatentTargetSummary[]>([]);
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);
  const [targetQuery, setTargetQuery] = useState('');
  const [targetSort, setTargetSort] = useState<'name' | 'count'>('name');
  const [targetsLoading, setTargetsLoading] = useState(false);
  const [targetsError, setTargetsError] = useState('');
  const today = useMemo(() => new Date(), []);
  const [calendarMonth, setCalendarMonth] = useState(() => ({
    year: today.getFullYear(),
    month: today.getMonth() + 1,
  }));
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() =>
    toLocalDateKey(today),
  );
  const [schedule, setSchedule] = useState<PatentScheduleResult | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState('');
  /** null이면 단계 필터 없이 전체를 본다. */
  const [activeStageGroup, setActiveStageGroup] = useState<string | null>(null);
  const [stageSummary, setStageSummary] = useState<PatentStageSummary | null>(null);
  const [stagesLoading, setStagesLoading] = useState(false);
  const [stagesError, setStagesError] = useState('');

  // ---- 특허 목록 (patent table) ----
  const { message, modal } = AntApp.useApp();
  const { hasPermission } = useAccessContext();
  const canManage = hasPermission('patentAnalysis.manage');

  const [patents, setPatents] = useState<PatentRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState('');

  const [lookups, setLookups] = useState<PatentRecordLookups | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<PatentRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [todoPatent, setTodoPatent] = useState<PatentRecord | null>(null);

  /**
   * 검색 실행. 의존성이 없어 참조가 고정되므로 아래 헤더 effect가 한 번만 돈다.
   * 입력값은 PatentSearchBar가 들고 있다(한글 조합이 끊기지 않게 하려면 타이핑이
   * store를 거쳐 돌아오면 안 된다 — 컴포넌트 주석 참고).
   */
  const applySearch = useCallback((value: string) => {
    setPage(1);
    setSearch(value.trim());
  }, []);

  /** 검색바를 헤더의 breadcrumb과 같은 줄에 둔다. 값이 아니라 컴포넌트를 한 번만 심는다. */
  useEffect(() => {
    setHeaderContent(
      <div className="pm-header-row">
        <PageHeaderBreadcrumb items={[{ label: '특허 관리' }]} />
        {/* 검색 대상은 '관리 특허 목록'이다. 서버가 관리번호·출원번호·명칭·출원인을
            대소문자 구분 없이 부분 일치로 찾는다(patent-record.service). */}
        <PatentSearchBar onSearch={applySearch} />
      </div>,
    );
    return () => setHeaderContent(null);
  }, [applySearch, setHeaderContent]);

  const loadPatents = useCallback(async () => {
    setListLoading(true);
    setListError('');
    try {
      const result = await patentRecordApi.list({
        q: search || undefined,
        targets: selectedTargets.length > 0 ? selectedTargets : undefined,
        stageGroup: activeStageGroup ?? undefined,
        page,
        pageSize: PAGE_SIZE,
      });
      setPatents(result.items);
      setTotal(result.total);
    } catch (error) {
      setPatents([]);
      setTotal(0);
      setListError(getErrorMessage(error));
    } finally {
      setListLoading(false);
    }
  }, [activeStageGroup, page, search, selectedTargets]);

  /**
   * 진행 현황은 목록과 같은 검색·Target 필터를 쓴다. 단계 필터(activeStageGroup)는
   * 넘기지 않는다. 넘기면 선택한 단계만 건수가 남아 파이프라인이 무의미해진다.
   */
  const loadStages = useCallback(async () => {
    setStagesLoading(true);
    setStagesError('');
    try {
      setStageSummary(await patentRecordApi.stages({
        q: search || undefined,
        targets: selectedTargets.length > 0 ? selectedTargets : undefined,
      }));
    } catch (error) {
      setStageSummary(null);
      setStagesError(getErrorMessage(error));
    } finally {
      setStagesLoading(false);
    }
  }, [search, selectedTargets]);

  useEffect(() => {
    void loadStages();
  }, [loadStages]);

  const loadTargets = useCallback(async () => {
    setTargetsLoading(true);
    setTargetsError('');
    try {
      const result = await patentRecordApi.targets();
      setTargets(result);
      // 삭제·수정·재임포트로 사라진 Target은 선택에서도 제거한다.
      const availableTargets = new Set(result.map((item) => item.target));
      setSelectedTargets((current) =>
        current.filter((target) => availableTargets.has(target)),
      );
    } catch (error) {
      setTargets([]);
      setTargetsError(getErrorMessage(error));
    } finally {
      setTargetsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTargets();
  }, [loadTargets]);

  const loadSchedule = useCallback(async () => {
    setScheduleLoading(true);
    setScheduleError('');
    try {
      setSchedule(await patentRecordApi.schedule({
        year: calendarMonth.year,
        month: calendarMonth.month,
        targets: selectedTargets.length > 0 ? selectedTargets : undefined,
      }));
    } catch (error) {
      setSchedule(null);
      setScheduleError(getErrorMessage(error));
    } finally {
      setScheduleLoading(false);
    }
  }, [calendarMonth.month, calendarMonth.year, selectedTargets]);

  useEffect(() => {
    void loadSchedule();
  }, [loadSchedule]);

  useEffect(() => {
    void loadPatents();
  }, [loadPatents]);

  /** 같은 단계를 다시 누르면 필터를 해제한다. 목록은 1페이지부터 다시 본다. */
  const toggleStageGroup = (code: string) => {
    setPage(1);
    setActiveStageGroup((current) => (current === code ? null : code));
  };

  /** modal의 select 옵션은 처음 열 때 한 번만 받아 둔다. */
  const ensureLookups = useCallback(async () => {
    if (lookups) return;
    try {
      setLookups(await patentRecordApi.lookups());
    } catch (error) {
      void message.error(`선택 목록을 불러오지 못했습니다: ${getErrorMessage(error)}`);
    }
  }, [lookups, message]);

  const openCreateModal = () => {
    setEditingRecord(null);
    setIsModalOpen(true);
    void ensureLookups();
  };

  const openEditModal = (record: PatentRecord) => {
    setEditingRecord(record);
    setIsModalOpen(true);
    void ensureLookups();
  };

  const handleSubmit = async (values: CreatePatentRecordInput) => {
    setSubmitting(true);
    try {
      if (editingRecord) {
        await patentRecordApi.update(editingRecord.id, values);
        void message.success('특허를 변경했습니다.');
      } else {
        await patentRecordApi.create(values);
        void message.success('특허를 추가했습니다.');
        setPage(1);
      }
      setIsModalOpen(false);
      setEditingRecord(null);
      await Promise.all([loadPatents(), loadTargets(), loadSchedule(), loadStages()]);
    } catch (error) {
      void message.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = (record: PatentRecord) => {
    modal.confirm({
      title: '특허를 삭제할까요?',
      content: `출원번호 ${record.applicationNumber}. 연결된 IPC와 행정 처리 이력도 함께 삭제됩니다.`,
      okText: '삭제',
      okButtonProps: { danger: true },
      cancelText: '취소',
      onOk: async () => {
        try {
          await patentRecordApi.remove(record.id);
          void message.success('특허를 삭제했습니다.');
          void loadTargets();
          void loadSchedule();
          void loadStages();
          // 마지막 항목을 지웠으면 이전 페이지로 물러난다.
          if (patents.length === 1 && page > 1) setPage(page - 1);
          else await loadPatents();
        } catch (error) {
          void message.error(getErrorMessage(error));
          throw error;
        }
      },
    });
  };

  const visibleTargets = useMemo(() => {
    const query = targetQuery.trim().toLocaleLowerCase();
    const filtered = query
      ? targets.filter((item) => item.target.toLocaleLowerCase().includes(query))
      : targets;
    return [...filtered].sort((a, b) =>
      targetSort === 'count'
        ? b.count - a.count || a.target.localeCompare(b.target)
        : a.target.localeCompare(b.target),
    );
  }, [targetQuery, targetSort, targets]);

  /**
   * 파이프라인에 그릴 타일. 상세 14단계는 한 줄에 안 들어가므로 대분류만 그리고
   * 상세 단계는 hover popover로 보여 준다. 미분류는 건수가 있을 때만 맨 뒤에 붙인다.
   */
  const stageGroupTiles = useMemo<StageTile[]>(() => {
    if (!stageSummary) return [];

    const tiles: StageTile[] = stageSummary.groups.map((group) => ({
      code: group.code,
      label: group.label,
      count: group.count,
      icon: stageGroupIcon(group.code),
      rows: group.stages
        // 비활성 단계는 건수가 남아 있을 때만 보여 준다(집계에서 빠지면 합계가 어긋난다).
        .filter((stage) => stage.active || stage.count > 0)
        .map((stage) => ({
          key: stage.code,
          label: stage.label,
          scope: stage.scope,
          count: stage.count,
        })),
    }));

    if (stageSummary.unmapped.count > 0) {
      tiles.push({
        code: UNMAPPED_STAGE_GROUP,
        label: '미분류',
        count: stageSummary.unmapped.count,
        icon: stageGroupIcon(UNMAPPED_STAGE_GROUP),
        note: '진행 단계에 연결되지 않은 현재 Status입니다.',
        rows: stageSummary.unmapped.statuses.map((row) => ({
          key: String(row.legalStatusId ?? 'none'),
          label: row.status ?? '(Status 없음)',
          scope: null,
          count: row.count,
        })),
      });
    }

    return tiles;
  }, [stageSummary]);

  /** 목록 헤더에 붙는 단계 필터 표시. 타일 라벨과 같은 값을 쓴다. */
  const activeStageLabel = useMemo(() => {
    if (activeStageGroup === null) return '';
    return (
      stageGroupTiles.find((tile) => tile.code === activeStageGroup)?.label ??
      activeStageGroup
    );
  }, [activeStageGroup, stageGroupTiles]);

  const toggleTarget = (target: string) => {
    setSelectedTargets((current) =>
      current.includes(target)
        ? current.filter((item) => item !== target)
        : [...current, target],
    );
    setPage(1);
  };

  const calendarCells = useMemo(
    () => buildMonthGrid(calendarMonth.year, calendarMonth.month),
    [calendarMonth.month, calendarMonth.year],
  );
  /** 그리드가 앞뒤 달을 물어 연말·연초에는 두 해가 걸린다. */
  const calendarYears = useMemo(
    () => [...new Set(calendarCells.map((cell) => Number(cell.date.slice(0, 4))))],
    [calendarCells],
  );
  const getHolidayName = useHolidayName(calendarYears);
  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, PatentScheduleEvent[]>();
    (schedule?.events ?? []).forEach((event) => {
      grouped.set(event.date, [...(grouped.get(event.date) ?? []), event]);
    });
    return grouped;
  }, [schedule?.events]);
  const todayKey = useMemo(() => toLocalDateKey(today), [today]);

  /** offset은 월 단위. 연 단위 이동은 12의 배수로 넘긴다. */
  const moveCalendarMonth = (offset: number) => {
    const next = new Date(calendarMonth.year, calendarMonth.month - 1 + offset, 1);
    const nextMonth = { year: next.getFullYear(), month: next.getMonth() + 1 };
    setCalendarMonth(nextMonth);
    setSelectedCalendarDate(
      nextMonth.year === today.getFullYear() && nextMonth.month === today.getMonth() + 1
        ? toLocalDateKey(today)
        : toLocalDateKey(next),
    );
  };

  const columns: TableColumnsType<PatentRecord> = [
    {
      title: '내부관리번호',
      key: 'internalRef',
      width: 132,
      render: (_, record) => {
        if (!record.internalRef) return emptyDash(null);
        // 파싱된 구성요소가 없으면 IP팀 규칙에서 벗어난 값이다. 막지 않고 표시만 한다.
        const unparsed = record.refOrigin === null;
        return (
          <Tooltip title={unparsed ? '알려진 번호 규칙과 형식이 다릅니다' : undefined}>
            <span>
              {highlightMatch(record.internalRef, search)}
              {unparsed && <Tag color="orange" style={{ marginLeft: 6 }}>규칙 외</Tag>}
            </span>
          </Tooltip>
        );
      },
    },
    {
      title: '국가',
      key: 'country',
      width: 80,
      render: (_, record) => record.country?.country ?? '-',
    },
    {
      title: '출원번호',
      dataIndex: 'applicationNumber',
      key: 'applicationNumber',
      width: 168,
      render: (value: string) => highlightMatch(value, search),
    },
    {
      title: '출원일',
      dataIndex: 'applicationDate',
      key: 'applicationDate',
      width: 110,
      render: (value: string | null) => formatDisplayDateOnly(value),
    },
    {
      title: '명칭',
      key: 'title',
      width: 260,
      render: (_, record) => (
        <Tooltip title={record.englishTitle ?? record.koreanTitle ?? ''}>
          <span className="pm-ellipsis">
            {highlightMatch(record.koreanTitle ?? record.englishTitle, search) ?? '-'}
          </span>
        </Tooltip>
      ),
    },
    {
      title: '출원인',
      dataIndex: 'applicant',
      key: 'applicant',
      width: 140,
      render: (value: string | null) => highlightMatch(value, search) ?? emptyDash(null),
    },
    {
      title: '대리인',
      key: 'attorney',
      width: 110,
      render: (_, record) => record.attorney?.attorneyName ?? emptyDash(null),
    },
    {
      title: '법적 상태',
      key: 'legalStatus',
      width: 110,
      render: (_, record) =>
        record.legalStatus ? <Tag color="blue">{record.legalStatus.status}</Tag> : emptyDash(null),
    },
    {
      title: '심사 상태',
      key: 'examStatus',
      width: 110,
      render: (_, record) =>
        record.examStatus ? <Tag>{record.examStatus.status}</Tag> : emptyDash(null),
    },
    {
      title: '등록번호',
      dataIndex: 'registrationNumber',
      key: 'registrationNumber',
      width: 140,
      render: emptyDash,
    },
    ...(canManage
      ? [
          {
            title: '',
            key: 'actions',
            width: 128,
            align: 'center' as const,
            render: (_: unknown, record: PatentRecord) => (
              <span style={{ display: 'inline-flex', gap: 2 }}>
                <Tooltip title="To-do 관리">
                  <Button
                    type="text"
                    size="small"
                    aria-label={`${record.applicationNumber} To-do 관리`}
                    icon={<ListTodo size={15} />}
                    onClick={() => setTodoPatent(record)}
                  />
                </Tooltip>
                <Tooltip title="변경">
                  <Button
                    type="text"
                    size="small"
                    aria-label={`${record.applicationNumber} 변경`}
                    icon={<Pencil size={15} />}
                    onClick={() => openEditModal(record)}
                  />
                </Tooltip>
                <Tooltip title="삭제">
                  <Button
                    type="text"
                    size="small"
                    danger
                    aria-label={`${record.applicationNumber} 삭제`}
                    icon={<Trash2 size={15} />}
                    onClick={() => confirmDelete(record)}
                  />
                </Tooltip>
              </span>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="pm-page">
      {/* ---- 상단: 진행 현황 · 일정 · To-do (같은 높이의 3열) ---- */}
      <div className="pm-toprow">
        <section className="pm-card pm-toprow-card pm-progress-card">
          <div className="pm-card-header">
            <span className="pm-progress-title">진행 현황</span>
            {stageSummary && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                총 {formatNumberWithComma(stageSummary.total)}건
                {activeStageGroup !== null && ' · 단계 필터 적용 중'}
              </Text>
            )}
          </div>

          {/* 선택된 Target이 없으면 영역째로 빼서 빈 div의 아래 여백이 남지 않게 한다. */}
          {selectedTargets.length > 0 && (
            <div className="pm-progress-tags">
              <div className="pm-progress-tag-list">
                {selectedTargets.map((target) => (
                  <Tag key={target} closable onClose={() => toggleTarget(target)} style={{ margin: 0, padding: '4px 10px', borderRadius: 8 }}>
                    {target}
                  </Tag>
                ))}
              </div>
            </div>
          )}

          {stagesError ? (
            <Text type="danger" className="pm-schedule-status">
              진행 현황을 불러오지 못했습니다: {stagesError}
            </Text>
          ) : !stageSummary ? (
            <Text type="secondary" className="pm-schedule-status">
              {stagesLoading ? '진행 현황을 불러오는 중입니다.' : '진행 현황이 없습니다.'}
            </Text>
          ) : (
            <div className="pm-pipeline">
              {stageGroupTiles.map((tile, index) => (
                <React.Fragment key={tile.code}>
                  {index > 0 && (
                    <span className="pm-stage-separator" aria-hidden>
                      <ChevronRight size={18} />
                    </span>
                  )}
                  <Popover
                    placement="bottom"
                    mouseEnterDelay={0.2}
                    classNames={{ body: 'pm-stage-popover-body' }}
                    content={renderStageDetail(tile, activeStageGroup === tile.code)}
                  >
                    <button
                      type="button"
                      onClick={() => toggleStageGroup(tile.code)}
                      aria-pressed={activeStageGroup === tile.code}
                      className={`pm-stage${activeStageGroup === tile.code ? ' pm-stage-active' : ''}`}
                    >
                      <span style={{ opacity: 0.85 }}>{tile.icon}</span>
                      <span className="pm-stage-label">{tile.label}</span>
                      <span className="pm-stage-count">{formatNumberWithComma(tile.count)}</span>
                    </button>
                  </Popover>
                </React.Fragment>
              ))}
            </div>
          )}
        </section>

        <section className="pm-card pm-toprow-card pm-schedule-card">
          <div className="pm-card-header">
            <span className="pm-card-title">일정</span>
          </div>

          {/* << < 2026년 8월 > >> — 홑화살표는 월, 겹화살표는 연 단위로 움직인다. */}
          <div className="pm-calendar-nav">
            <Button
              type="text"
              size="small"
              aria-label="이전 해"
              icon={<ChevronsLeft size={14} />}
              onClick={() => moveCalendarMonth(-12)}
            />
            <Button
              type="text"
              size="small"
              aria-label="이전 달"
              icon={<ChevronLeft size={14} />}
              onClick={() => moveCalendarMonth(-1)}
            />
            <span className="pm-calendar-nav-label">
              {`${calendarMonth.year}년 ${calendarMonth.month}월`}
            </span>
            <Button
              type="text"
              size="small"
              aria-label="다음 달"
              icon={<ChevronRight size={14} />}
              onClick={() => moveCalendarMonth(1)}
            />
            <Button
              type="text"
              size="small"
              aria-label="다음 해"
              icon={<ChevronsRight size={14} />}
              onClick={() => moveCalendarMonth(12)}
            />
          </div>

          <div className="pm-calendar-grid">
            {WEEKDAYS.map((weekday, index) => (
              <div
                key={weekday}
                className={`pm-calendar-weekday${
                  index === 0 ? ' pm-calendar-weekday-sun' : index === 6 ? ' pm-calendar-weekday-sat' : ''
                }`}
              >
                {weekday}
              </div>
            ))}
            {calendarCells.map((cell, index) => {
              const classNames = ['pm-calendar-day'];
              const dayEvents = eventsByDate.get(cell.date) ?? [];
              const weekday = index % 7;
              const holidayName = getHolidayName(cell.date);
              // 일요일과 공휴일은 빨간색, 토요일은 하늘색으로 칠한다.
              if (weekday === 0 || holidayName) classNames.push('pm-calendar-day-holiday');
              else if (weekday === 6) classNames.push('pm-calendar-day-saturday');
              if (!cell.inMonth) classNames.push('pm-calendar-day-muted');
              if (dayEvents.length > 0) classNames.push('pm-calendar-day-due');
              if (cell.date === todayKey) classNames.push('pm-calendar-day-today');
              if (cell.date === selectedCalendarDate) classNames.push('pm-calendar-day-selected');
              const labelParts = [formatDisplayDateOnly(cell.date)];
              if (holidayName) labelParts.push(holidayName);
              if (dayEvents.length > 0) labelParts.push(`일정 ${dayEvents.length}건`);
              const tooltipLines = [
                ...(holidayName ? [holidayName] : []),
                ...dayEvents.map((event) => `${event.label} · ${event.internalRef ?? event.applicationNumber}`),
              ];
              const day = (
                <button
                  type="button"
                  key={`${cell.date}-${index}`}
                  className={classNames.join(' ')}
                  disabled={!cell.inMonth}
                  aria-label={labelParts.join(', ')}
                  onClick={() => cell.inMonth && setSelectedCalendarDate(cell.date)}
                >
                  <span className="pm-calendar-day-mark">{cell.day}</span>
                </button>
              );
              return tooltipLines.length > 0 ? (
                <Tooltip key={`${cell.date}-${index}`} title={tooltipLines.join('\n')}>
                  {day}
                </Tooltip>
              ) : day;
            })}
          </div>
        </section>

        <section className="pm-card pm-toprow-card pm-todo-card">
          <div className="pm-card-header">
            <span className="pm-card-title" style={{ fontSize: 13 }}>To-do</span>
            <Text type="secondary" style={{ fontSize: 12 }}>
              총 {formatNumberWithComma(schedule?.todoTotal ?? 0)}건
            </Text>
          </div>
          <div className="pm-todo-list">
            {scheduleLoading ? (
              <Text type="secondary" className="pm-schedule-status">To-do를 불러오는 중입니다.</Text>
            ) : scheduleError ? (
              <Text type="danger" className="pm-schedule-status">To-do를 불러오지 못했습니다.</Text>
            ) : (schedule?.todos.length ?? 0) === 0 ? (
              <Text type="secondary" className="pm-schedule-status">등록된 To-do 마감일이 없습니다.</Text>
            ) : (
              schedule?.todos.map((todo) => {
                const daysLeft = calendarDayDifference(todo.dueDate);
                return (
                  <div key={todo.todoId} className="pm-deadline-row">
                    <span className={ddayClassName(daysLeft)}>{ddayLabel(daysLeft)}</span>
                    <Tooltip
                      title={[todo.patentTitle, todo.description].filter(Boolean).join(' · ') || todo.applicationNumber}
                    >
                      <span className="pm-deadline-label">
                        {todo.title} · {todo.internalRef ?? todo.applicationNumber} ({todo.country})
                      </span>
                    </Tooltip>
                    <span className="pm-deadline-date">{formatDisplayDateOnly(todo.dueDate)}</span>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      {/* flex 배치라 뷰어 유무를 클래스로 구분할 필요가 없다. 열이 있으면 자리를 차지한다. */}
      <div className="pm-layout">
        <div className="pm-column pm-column-aside">
          <section className="pm-card">
            <div className="pm-card-header">
              <span className="pm-card-title">Target</span>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <Input
                allowClear
                value={targetQuery}
                onChange={(event) => setTargetQuery(event.target.value)}
                placeholder="Target 검색"
                prefix={<Search size={14} />}
                style={{ height: 32 }}
              />
              <Tooltip title={targetSort === 'name' ? '건수순으로 정렬' : '이름순으로 정렬'}>
                <Button
                  aria-label={targetSort === 'name' ? 'Target 건수순 정렬' : 'Target 이름순 정렬'}
                  icon={<ArrowUpDown size={14} />}
                  onClick={() => setTargetSort((current) => current === 'name' ? 'count' : 'name')}
                  style={{ height: 32, width: 36 }}
                />
              </Tooltip>
            </div>

            <div className="pm-compound-head">
              <span />
              <span>이름</span>
              <span className="pm-compound-count">건수</span>
            </div>

            <div className="pm-target-list">
              {targetsLoading && (
                <Text type="secondary" className="pm-target-status">Target 목록을 불러오는 중입니다.</Text>
              )}
              {!targetsLoading && targetsError && (
                <Text type="danger" className="pm-target-status">
                  Target 목록을 불러오지 못했습니다: {targetsError}
                </Text>
              )}
              {!targetsLoading && !targetsError && visibleTargets.length === 0 && (
                <Text type="secondary" className="pm-target-status">
                  {targetQuery.trim() ? '검색 조건에 맞는 Target이 없습니다.' : '등록된 Target이 없습니다.'}
                </Text>
              )}

              {visibleTargets.map((item) => {
                const checked = selectedTargets.includes(item.target);
                return (
                  <label
                    key={item.target}
                    className={`pm-compound-row${checked ? ' pm-compound-row-selected' : ''}`}
                  >
                    <Checkbox checked={checked} onChange={() => toggleTarget(item.target)} />
                    <span className="pm-target-name" title={item.target}>{item.target}</span>
                    <span className="pm-compound-count">{formatNumberWithComma(item.count)}</span>
                  </label>
                );
              })}
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: 12,
                paddingTop: 12,
                borderTop: '1px solid var(--border-color)',
                fontSize: 12,
              }}
            >
              <span>
                총 {formatNumberWithComma(targets.length)}건{' '}
                <Text style={{ color: 'var(--brand-primary)', fontWeight: 600, fontSize: 12 }}>
                  {selectedTargets.length}개 선택
                </Text>
              </span>
            </div>
          </section>
        </div>

        {/* ---- centre: patent table ---- */}
        <div className="pm-column pm-column-main">
          <section className="pm-card">
            <div className="pm-card-header pm-list-header">
              <span className="pm-list-header-title">
                <span className="pm-card-title">관리 특허 목록</span>
                {search && (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    ‘{search}’ 검색 결과
                  </Text>
                )}
                {activeStageGroup !== null && (
                  <Tag
                    closable
                    onClose={() => toggleStageGroup(activeStageGroup)}
                    style={{ margin: 0 }}
                  >
                    {activeStageLabel}
                  </Tag>
                )}
              </span>
              <span className="pm-list-header-controls">
                {canManage && (
                  <Button
                    icon={<UploadCloud size={14} />}
                    style={{ height: 34 }}
                    onClick={() => setIsImportOpen(true)}
                  >
                    CSV로 업로드
                  </Button>
                )}
                {canManage && (
                  <Button
                    type="primary"
                    icon={<Plus size={14} />}
                    style={{ height: 34 }}
                    onClick={openCreateModal}
                  >
                    관리 특허 추가
                  </Button>
                )}
              </span>
            </div>

            <Table<PatentRecord>
              columns={columns}
              dataSource={patents}
              rowKey="id"
              loading={listLoading}
              size="small"
              pagination={false}
              scroll={{ x: 'max-content' }}
              locale={{ emptyText: listError ? `목록을 불러오지 못했습니다: ${listError}` : '등록된 특허가 없습니다.' }}
            />

            <div
              className="pm-list-footer"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}
            >
              <span>총 {formatNumberWithComma(total)}건</span>
              <Pagination
                simple
                size="small"
                current={page}
                total={total}
                pageSize={PAGE_SIZE}
                onChange={setPage}
              />
            </div>
          </section>
        </div>
      </div>

      <PatentRecordFormModal
        open={isModalOpen}
        record={editingRecord}
        lookups={lookups}
        submitting={submitting}
        onCancel={() => {
          setIsModalOpen(false);
          setEditingRecord(null);
        }}
        onSubmit={(values) => void handleSubmit(values)}
      />

      <PatentCsvImportModal
        open={isImportOpen}
        onCancel={() => setIsImportOpen(false)}
        onApplied={() => {
          // 코드가 새로 생겼을 수 있으니 select 옵션 캐시도 버린다.
          setLookups(null);
          setPage(1);
          void loadPatents();
          void loadTargets();
          void loadSchedule();
          void loadStages();
        }}
      />

      <PatentTodoModal
        open={todoPatent !== null}
        patent={todoPatent}
        onClose={() => setTodoPatent(null)}
        onChanged={() => void loadSchedule()}
      />

    </div>
  );
};

export default PatentManagement;
