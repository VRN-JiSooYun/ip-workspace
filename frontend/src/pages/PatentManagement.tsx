import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  App as AntApp,
  Button,
  Checkbox,
  Input,
  Pagination,
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
  ClipboardList,
  FileCheck,
  Filter,
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
import PatentTodoModal from '../components/patent-management/PatentTodoModal';
import { useAccessContext } from '../contexts/AccessContext';
import {
  patentRecordApi,
  type CreatePatentRecordInput,
  type PatentRecord,
  type PatentRecordLookups,
  type PatentScheduleEvent,
  type PatentScheduleResult,
  type PatentTargetSummary,
} from '../services/patentRecordApi';
import { useUIStore } from '../store/useUIStore';
import { formatDisplayDateOnly, formatNumberWithComma } from '../utils/displayFormat';
import './PatentManagement.css';

const { Text } = Typography;

const PAGE_SIZE = 20;

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';

const emptyDash = (value: string | null | undefined) => value ?? '-';

/**
 * 특허 관리 — compound-driven patent portfolio view.
 *
 * 관련 특허 목록은 `/api/patent-records`(로컬 `patent` table)만 본다. 추가·변경·삭제
 * 대상이 이 table이다.
 *
 * 예전에는 `/api/patent-search`(외부 문서 전문 검색)를 토글로 함께 보여주고 행을 누르면
 * 오른쪽 문서 뷰어를 띄웠다. 문서 검색은 의견제출통지서 화면(`OfficeActionAnalysis`)으로
 * 일원화해서 여기서는 뺐다.
 *
 * 진행 단계 pipeline은 아직 placeholder 상수다. 일정·To-do·Target은 로컬 DB를 조회한다.
 */

type StageKey =
  | 'prep'
  | 'filed'
  | 'exam'
  | 'response'
  | 'reg-prep'
  | 'registered'
  | 'closed';

const STAGES: Array<{ key: StageKey; label: string; count: number; icon: React.ReactNode }> = [
  { key: 'prep', label: '출원 준비', count: 5, icon: <ClipboardList size={18} /> },
  { key: 'filed', label: '출원', count: 18, icon: <Send size={18} /> },
  { key: 'exam', label: '심사', count: 11, icon: <Gavel size={18} /> },
  { key: 'response', label: '대응', count: 7, icon: <Reply size={18} /> },
  { key: 'reg-prep', label: '등록 준비', count: 4, icon: <FileCheck size={18} /> },
  { key: 'registered', label: '등록', count: 9, icon: <Award size={18} /> },
  { key: 'closed', label: '종결', count: 3, icon: <Archive size={18} /> },
];

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
  const [activeStage, setActiveStage] = useState<StageKey>('filed');

  // ---- 특허 목록 (patent table) ----
  const { message, modal } = AntApp.useApp();
  const { hasPermission } = useAccessContext();
  const canManage = hasPermission('patentAnalysis.manage');

  const [patents, setPatents] = useState<PatentRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState('');

  const [lookups, setLookups] = useState<PatentRecordLookups | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<PatentRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [todoPatent, setTodoPatent] = useState<PatentRecord | null>(null);

  useEffect(() => {
    setHeaderContent(<PageHeaderBreadcrumb items={[{ label: '특허 관리' }]} />);
    return () => setHeaderContent(null);
  }, [setHeaderContent]);

  const loadPatents = useCallback(async () => {
    setListLoading(true);
    setListError('');
    try {
      const result = await patentRecordApi.list({
        q: search || undefined,
        targets: selectedTargets.length > 0 ? selectedTargets : undefined,
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
  }, [page, search, selectedTargets]);

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

  const applySearch = () => {
    setPage(1);
    setSearch(searchInput.trim());
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
      await Promise.all([loadPatents(), loadTargets(), loadSchedule()]);
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
  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, PatentScheduleEvent[]>();
    (schedule?.events ?? []).forEach((event) => {
      grouped.set(event.date, [...(grouped.get(event.date) ?? []), event]);
    });
    return grouped;
  }, [schedule?.events]);
  const selectedDateEvents = eventsByDate.get(selectedCalendarDate) ?? [];

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
              {record.internalRef}
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
    { title: '출원번호', dataIndex: 'applicationNumber', key: 'applicationNumber', width: 168 },
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
          <span className="pm-ellipsis">{record.koreanTitle ?? record.englishTitle ?? '-'}</span>
        </Tooltip>
      ),
    },
    { title: '출원인', dataIndex: 'applicant', key: 'applicant', width: 140, render: emptyDash },
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
    // flex 배치라 뷰어 유무를 클래스로 구분할 필요가 없다. 열이 있으면 자리를 차지한다.
    <div className="pm-layout">
      {/* ---- left: deadlines and compounds ---- */}
      <div className="pm-column pm-column-aside">
        <section className="pm-card">
          <div className="pm-card-header">
            <span className="pm-card-title">일정</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Text style={{ fontSize: 12 }}>{`${calendarMonth.year}년 ${calendarMonth.month}월`}</Text>
              <Button
                type="text"
                size="small"
                aria-label="이전 달"
                icon={<ChevronLeft size={14} />}
                onClick={() => moveCalendarMonth(-1)}
              />
              <Button
                type="text"
                size="small"
                aria-label="다음 달"
                icon={<ChevronRight size={14} />}
                onClick={() => moveCalendarMonth(1)}
              />
            </span>
          </div>

          <div className="pm-calendar-grid">
            {WEEKDAYS.map((weekday) => (
              <div key={weekday} className="pm-calendar-weekday">{weekday}</div>
            ))}
            {calendarCells.map((cell, index) => {
              const classNames = ['pm-calendar-day'];
              const dayEvents = eventsByDate.get(cell.date) ?? [];
              if (!cell.inMonth) classNames.push('pm-calendar-day-muted');
              if (dayEvents.length > 0) classNames.push('pm-calendar-day-due');
              if (cell.date === selectedCalendarDate) classNames.push('pm-calendar-day-selected');
              const day = (
                <button
                  type="button"
                  key={`${cell.date}-${index}`}
                  className={classNames.join(' ')}
                  disabled={!cell.inMonth}
                  aria-label={`${formatDisplayDateOnly(cell.date)}${dayEvents.length > 0 ? `, 일정 ${dayEvents.length}건` : ''}`}
                  onClick={() => cell.inMonth && setSelectedCalendarDate(cell.date)}
                >
                  {cell.day}
                </button>
              );
              return dayEvents.length > 0 ? (
                <Tooltip
                  key={`${cell.date}-${index}`}
                  title={dayEvents.map((event) => `${event.label} · ${event.internalRef ?? event.applicationNumber}`).join('\n')}
                >
                  {day}
                </Tooltip>
              ) : day;
            })}
          </div>

          <div className="pm-calendar-event-list">
            {scheduleLoading ? (
              <Text type="secondary">일정을 불러오는 중입니다.</Text>
            ) : scheduleError ? (
              <Text type="danger">일정을 불러오지 못했습니다: {scheduleError}</Text>
            ) : selectedDateEvents.length > 0 ? (
              selectedDateEvents.slice(0, 4).map((event) => (
                <div
                  key={`${event.patentId}-${event.todoId ?? event.type}-${event.date}`}
                  className="pm-calendar-event-row"
                >
                  <Tag>{event.label}</Tag>
                  <span title={event.title ?? undefined}>
                    {event.type === 'TODO' && event.title ? `${event.title} · ` : ''}
                    {event.internalRef ?? event.applicationNumber} ({event.country})
                  </span>
                </div>
              ))
            ) : (
              <Text type="secondary">{formatDisplayDateOnly(selectedCalendarDate)} 일정이 없습니다.</Text>
            )}
            {selectedDateEvents.length > 4 && (
              <Text type="secondary">외 {formatNumberWithComma(selectedDateEvents.length - 4)}건</Text>
            )}
          </div>
        </section>

        <section className="pm-card">
          <div className="pm-card-header">
            <span className="pm-card-title" style={{ fontSize: 13 }}>To-do</span>
            <Text type="secondary" style={{ fontSize: 12 }}>
              총 {formatNumberWithComma(schedule?.todoTotal ?? 0)}건
            </Text>
          </div>
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
        </section>

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

      {/* ---- centre: stage pipeline and patent table ---- */}
      <div className="pm-column pm-column-main">
        <section className="pm-card">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: 19, fontWeight: 700, color: 'var(--text-primary)' }}>
              진행 현황 
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {selectedTargets.map((target) => (
                <Tag key={target} closable onClose={() => toggleTarget(target)} style={{ margin: 0, padding: '4px 10px', borderRadius: 8 }}>
                  {target}
                </Tag>
              ))}
            </div>
          </div>

          <div className="pm-pipeline">
            {STAGES.map((stage, index) => (
              <React.Fragment key={stage.key}>
                {index > 0 && (
                  <span className="pm-stage-separator" aria-hidden>
                    <ChevronRight size={18} />
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setActiveStage(stage.key)}
                  aria-pressed={activeStage === stage.key}
                  className={`pm-stage${activeStage === stage.key ? ' pm-stage-active' : ''}`}
                >
                  <span style={{ opacity: 0.85 }}>{stage.icon}</span>
                  <span className="pm-stage-label">{stage.label}</span>
                  <span className="pm-stage-count">{stage.count}</span>
                </button>
              </React.Fragment>
            ))}
          </div>
        </section>

        <section className="pm-card">
          <div className="pm-card-header pm-list-header">
            <span className="pm-list-header-title">
              <span className="pm-card-title">관련 특허 목록</span>
            </span>
            <span className="pm-list-header-controls">
              <Input
                allowClear
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                onPressEnter={applySearch}
                placeholder="관리번호 · 출원번호 · 명칭 · 출원인"
                prefix={<Search size={14} />}
                style={{ width: 220, height: 34 }}
              />
              <Button icon={<Filter size={14} />} style={{ height: 34 }} onClick={applySearch}>
                검색
              </Button>
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

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, fontSize: 12 }}>
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
