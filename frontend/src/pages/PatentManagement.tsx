import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  App as AntApp,
  Button,
  Pagination,
  Segmented,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import type { TableColumnsType } from 'antd';
import type { PatentSearchItem } from '../services/patentSearchApi';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  FileText,
  ListTodo,
  Pencil,
  Plus,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import PageHeaderBreadcrumb from '../components/common/PageHeaderBreadcrumb';
import ResizableSidePanel from '../components/common/ResizableSidePanel';
import PatentCsvImportModal from '../components/patent-management/PatentCsvImportModal';
import PatentFilterCard from '../components/patent-management/PatentFilterCard';
import { type PatentListFilterValues } from '../components/patent-management/PatentListFilters';
import { buildStageTiles } from '../components/patent-management/PatentProgressPipeline';
import PatentDocumentViewer from '../components/patent-management/PatentDocumentViewer';
import PatentRecordFormModal from '../components/patent-management/PatentRecordFormModal';
import PatentSearchBar from '../components/patent-management/PatentSearchBar';
import PatentTodoModal from '../components/patent-management/PatentTodoModal';
import { useAccessContext } from '../contexts/AccessContext';
import {
  patentRecordApi,
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
  /** Shift+클릭 범위 선택의 기준점. 마지막으로 수식키 없이/Ctrl로 누른 Target이다. */
  const [targetAnchor, setTargetAnchor] = useState<string | null>(null);
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
  /** 국가·법적상태·심사상태. 목록과 진행 현황 집계가 함께 쓴다. */
  const [listFilters, setListFilters] = useState<PatentListFilterValues>({});
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
  /** 우측 문서 뷰어에 띄운 특허. null이면 패널을 닫는다. */
  const [documentPatent, setDocumentPatent] = useState<PatentRecord | null>(null);
  const [documentItems, setDocumentItems] = useState<PatentSearchItem[]>([]);
  /** 통지서가 여러 건일 때 보고 있는 것. officeActionId를 쓴다. */
  const [activeDocumentId, setActiveDocumentId] = useState<number | null>(null);

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
        ...listFilters,
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
  }, [activeStageGroup, listFilters, page, search, selectedTargets]);

  /**
   * 진행 현황은 목록과 같은 검색·Target 필터를 쓴다. 단계 축의 조건(activeStageGroup,
   * stageCode)은 넘기지 않는다. 넘기면 고른 단계만 건수가 남아 파이프라인이 무의미해진다.
   */
  const loadStages = useCallback(async () => {
    setStagesLoading(true);
    setStagesError('');
    try {
      const { stageCode: _pipelineAxis, ...populationFilters } = listFilters;
      setStageSummary(await patentRecordApi.stages({
        q: search || undefined,
        targets: selectedTargets.length > 0 ? selectedTargets : undefined,
        ...populationFilters,
      }));
    } catch (error) {
      setStageSummary(null);
      setStagesError(getErrorMessage(error));
    } finally {
      setStagesLoading(false);
    }
  }, [listFilters, search, selectedTargets]);

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

  /** 코드 목록(국가·상태)은 상세 검색 필터와 modal이 같이 쓴다. 한 번만 받는다. */
  const ensureLookups = useCallback(async () => {
    if (lookups) return;
    try {
      setLookups(await patentRecordApi.lookups());
    } catch (error) {
      void message.error(`선택 목록을 불러오지 못했습니다: ${getErrorMessage(error)}`);
    }
  }, [lookups, message]);

  // 상세 검색 필터의 select가 진입 직후부터 채워져 있어야 한다.
  useEffect(() => {
    void ensureLookups();
  }, [ensureLookups]);

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

  /** 검색·정렬 UI를 걷어냈으므로 이름순으로 고정한다. */
  const visibleTargets = useMemo(
    () => [...targets].sort((a, b) => a.target.localeCompare(b.target)),
    [targets],
  );

  const stageGroupTiles = useMemo(() => buildStageTiles(stageSummary), [stageSummary]);

  /** 목록 헤더에 붙는 단계 필터 표시. 타일 라벨과 같은 값을 쓴다. */
  const activeStageLabel = useMemo(() => {
    if (activeStageGroup === null) return '';
    return (
      stageGroupTiles.find((tile) => tile.code === activeStageGroup)?.label ??
      activeStageGroup
    );
  }, [activeStageGroup, stageGroupTiles]);

  /**
   * 목록에서의 선택. 파일 탐색기·Finder와 같은 규칙을 따른다.
   *   그냥 클릭        하나만 선택(기존 선택 해제)
   *   Ctrl/⌘ + 클릭   토글해서 누적. anchor를 이 항목으로 옮긴다
   *   Shift + 클릭     anchor부터 이 항목까지 범위 선택. anchor는 그대로 둔다
   * macOS에서 ⌘를 쓰는 사용자가 많아 metaKey도 같이 받는다.
   */
  const selectTarget = (
    target: string,
    modifiers: { accumulate: boolean; range: boolean },
  ) => {
    const names = visibleTargets.map((item) => item.target);

    if (modifiers.range && targetAnchor && names.includes(targetAnchor)) {
      const from = names.indexOf(targetAnchor);
      const to = names.indexOf(target);
      const [start, end] = from <= to ? [from, to] : [to, from];
      const span = names.slice(start, end + 1);
      // Ctrl까지 함께 눌렀으면 기존 선택 위에 범위를 얹는다.
      setSelectedTargets(
        modifiers.accumulate
          ? [...new Set([...selectedTargets, ...span])]
          : span,
      );
    } else if (modifiers.accumulate) {
      setSelectedTargets((current) =>
        current.includes(target)
          ? current.filter((item) => item !== target)
          : [...current, target],
      );
      setTargetAnchor(target);
    } else {
      // 이미 이 항목만 선택된 상태에서 다시 누르면 해제한다(전체 보기로 돌아가는 길).
      const onlyThisSelected =
        selectedTargets.length === 1 && selectedTargets[0] === target;
      setSelectedTargets(onlyThisSelected ? [] : [target]);
      setTargetAnchor(onlyThisSelected ? null : target);
    }

    setPage(1);
  };

  /** 조건이 바뀌면 보던 페이지 번호는 의미가 없다. */
  const applyListFilters = (next: PatentListFilterValues) => {
    setListFilters(next);
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

  /** 패널을 연 특허가 바뀌면 문서를 다시 받아 첫 통지서를 띄운다. */
  useEffect(() => {
    if (!documentPatent) {
      setDocumentItems([]);
      setActiveDocumentId(null);
      return;
    }
    let active = true;
    void patentRecordApi
      .documents(documentPatent.id)
      .then((result) => {
        if (!active) return;
        setDocumentItems(result.items);
        setActiveDocumentId(result.items[0]?.officeActionId ?? null);
      })
      .catch((error) => {
        if (!active) return;
        setDocumentItems([]);
        setActiveDocumentId(null);
        void message.error(`문서를 불러오지 못했습니다: ${getErrorMessage(error)}`);
      });
    return () => {
      active = false;
    };
  }, [documentPatent, message]);

  const activeDocument =
    documentItems.find((item) => item.officeActionId === activeDocumentId) ??
    documentItems[0] ??
    null;

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
    {
      title: '문서',
      key: 'documents',
      width: 76,
      align: 'center' as const,
      render: (_, record) => {
        const count = record.documentCount ?? 0;
        // 문서가 없으면 아무것도 그리지 않는다. 있는 특허가 한눈에 드러나야 한다.
        if (count === 0) return emptyDash(null);
        return (
          <Tooltip title={`문서 ${count}건 보기`}>
            <Button
              type="text"
              size="small"
              className="pm-doc-open"
              icon={<FileText size={14} />}
              aria-label={`${record.internalRef ?? record.applicationNumber} 문서 ${count}건 보기`}
              onClick={() => setDocumentPatent(record)}
            >
              {count}
            </Button>
          </Tooltip>
        );
      },
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
    <div className={`pm-page${documentPatent ? ' pm-page-viewer-open' : ''}`}>
      {/* 문서 뷰어는 본문 전체(상단 3열 + 목록)의 형제다. 그래야 패널이 화면 높이를
          모두 쓰고, 왼쪽 본문만 따로 스크롤된다. */}
      <div className="pm-main">
        {/* ---- 상단: 진행 현황 · 일정 · To-do (같은 높이의 3열) ---- */}
      <div className="pm-toprow">
        <PatentFilterCard
          lookups={lookups}
          filters={listFilters}
          onFiltersChange={applyListFilters}
          selectedTargets={selectedTargets}
          onResetTargets={() => { setSelectedTargets([]); setPage(1); }}
          summary={stageSummary}
          stagesLoading={stagesLoading}
          stagesError={stagesError}
          activeStageGroup={activeStageGroup}
          onToggleStageGroup={toggleStageGroup}
        />

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
              <Tooltip title="Ctrl(⌘)+클릭으로 누적 선택, Shift+클릭으로 범위 선택">
              </Tooltip>
            </div>

            {/* 헤더를 목록 안에 두고 sticky로 붙인다. 밖에 두면 스크롤바 폭(15px)만큼
                '건수' 열이 행과 어긋나고, 스크롤하면 열 제목이 사라진다. */}
            <div className="pm-target-list">
              <div className="pm-compound-head">
                <span>프로젝트</span>
                <span className="pm-compound-count">건수</span>
              </div>

              {targetsLoading && (
                <Text type="secondary" className="pm-target-status">Target 목록을 불러오는 중입니다.</Text>
              )}
              {!targetsLoading && targetsError && (
                <Text type="danger" className="pm-target-status">
                  Target 목록을 불러오지 못했습니다: {targetsError}
                </Text>
              )}
              {!targetsLoading && !targetsError && visibleTargets.length === 0 && (
                <Text type="secondary" className="pm-target-status">등록된 Target이 없습니다.</Text>
              )}

              {visibleTargets.map((item) => {
                const selected = selectedTargets.includes(item.target);
                return (
                  <button
                    type="button"
                    key={item.target}
                    aria-pressed={selected}
                    className={`pm-compound-row${selected ? ' pm-compound-row-selected' : ''}`}
                    onClick={(event) => selectTarget(item.target, {
                      accumulate: event.ctrlKey || event.metaKey,
                      range: event.shiftKey,
                    })}
                  >
                    <span className="pm-target-name" title={item.target}>{item.target}</span>
                    <span className="pm-compound-count">{formatNumberWithComma(item.count)}</span>
                  </button>
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
      </div>

      {/* 본문의 형제라 화면 높이를 전부 쓴다.
          뷰어는 의견제출통지서 화면이 쓰는 것과 같은 컴포넌트다. */}
      {documentPatent && (
        <ResizableSidePanel label="문서 뷰어 너비 조절">
          <div className="pm-doc-panel">
            {/* 통지서가 여러 건이면 무엇을 볼지 먼저 고른다.
                뷰어 자체는 통지서 한 건을 그리는 컴포넌트라 바깥에 둔다. */}
            {documentItems.length > 1 && (
              <Segmented
                size="small"
                className="pm-doc-panel-switch"
                value={activeDocumentId}
                onChange={(value) => setActiveDocumentId(value as number)}
                options={documentItems.map((item, index) => ({
                  value: item.officeActionId ?? index,
                  label: `${item.action ?? '통지서'} ${formatDisplayDateOnly(item.actionDate)}`,
                }))}
              />
            )}
            <PatentDocumentViewer
              item={activeDocument}
              legalStatusLabel={activeDocument?.legalStatus ?? null}
              examStatusLabel={documentPatent.examStatus?.status ?? null}
              onClose={() => setDocumentPatent(null)}
            />
          </div>
        </ResizableSidePanel>
      )}

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
