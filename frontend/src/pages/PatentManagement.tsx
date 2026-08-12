import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  App as AntApp,
  Button,
  Checkbox,
  Input,
  Pagination,
  Segmented,
  Select,
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
  Info,
  Pencil,
  Plus,
  Reply,
  Search,
  Send,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import PageHeaderBreadcrumb from '../components/common/PageHeaderBreadcrumb';
import ResizableSidePanel from '../components/common/ResizableSidePanel';
import PatentCsvImportModal from '../components/patent-management/PatentCsvImportModal';
import PatentDocumentViewer from '../components/patent-management/PatentDocumentViewer';
import PatentRecordFormModal from '../components/patent-management/PatentRecordFormModal';
import { useAccessContext } from '../contexts/AccessContext';
import {
  patentRecordApi,
  type CreatePatentRecordInput,
  type PatentRecord,
  type PatentRecordLookups,
} from '../services/patentRecordApi';
import {
  PATENT_SEARCH_KEYWORD_TARGET_LABELS,
  PATENT_SEARCH_KEYWORD_TARGETS,
  patentSearchApi,
  type PatentSearchItem,
  type PatentSearchKeywordTarget,
} from '../services/patentSearchApi';
import { useUIStore } from '../store/useUIStore';
import { formatDisplayDateOnly, formatNumberWithComma } from '../utils/displayFormat';
import './PatentManagement.css';

const { Text } = Typography;

const PAGE_SIZE = 20;

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';

const emptyDash = (value: string | null | undefined) => value ?? '-';

/** 관련 특허 목록의 데이터 출처. */
type ListSource = 'search' | 'records';

/** 문서가 하나라도 붙어 있는 행만 뷰어로 열 수 있다. */
const hasDocuments = (item: PatentSearchItem): boolean =>
  item.contentLength > 0 ||
  item.documentPath !== null ||
  item.submissions.length > 0;

/**
 * 특허 관리 — compound-driven patent portfolio view.
 *
 * 관련 특허 목록은 두 출처를 토글로 바꿔 본다.
 * - `search`: `/api/patent-search` (외부 전문 검색). 결과 1건이 OA 1건이고 문서 본문이
 *   딸려 오므로 행을 클릭하면 오른쪽 문서 뷰어에 렌더링된다.
 * - `records`: `/api/patent-records` (로컬 `patent` table). 추가·변경·삭제 대상이다.
 *
 * 두 출처는 조회할 수 있는 조건이 다르다. 검색 API에는 출원번호·명칭 부분 일치 검색이 없고
 * 문서 전문 키워드와 구조화된 filter만 있다. 반대로 로컬 table에는 문서 본문이 없다.
 *
 * 나머지 패널(마감 일정, 화합물, 단계)은 아직 placeholder 상수다.
 */

type StageKey =
  | 'prep'
  | 'filed'
  | 'exam'
  | 'response'
  | 'reg-prep'
  | 'registered'
  | 'closed';

type Compound = { code: string; count: number };

type Deadline = {
  code: string;
  country: string;
  date: string;
  daysLeft: number;
};

const COMPOUNDS: Compound[] = [
  { code: 'A-1010', count: 12 },
  { code: 'B-2020', count: 9 },
  { code: 'C-3030', count: 7 },
  { code: 'D-4040', count: 8 },
  { code: 'E-5050', count: 6 },
  { code: 'F-6060', count: 5 },
  { code: 'G-7070', count: 4 },
  { code: 'H-8080', count: 3 },
];

const STAGES: Array<{ key: StageKey; label: string; count: number; icon: React.ReactNode }> = [
  { key: 'prep', label: '출원 준비', count: 5, icon: <ClipboardList size={18} /> },
  { key: 'filed', label: '출원', count: 18, icon: <Send size={18} /> },
  { key: 'exam', label: '심사', count: 11, icon: <Gavel size={18} /> },
  { key: 'response', label: '대응', count: 7, icon: <Reply size={18} /> },
  { key: 'reg-prep', label: '등록 준비', count: 4, icon: <FileCheck size={18} /> },
  { key: 'registered', label: '등록', count: 9, icon: <Award size={18} /> },
  { key: 'closed', label: '종결', count: 3, icon: <Archive size={18} /> },
];

const DEADLINES: Deadline[] = [
  { code: 'A-1010', country: 'KR', date: '2024-05-24', daysLeft: 3 },
  { code: 'B-2020', country: 'US', date: '2024-05-28', daysLeft: 7 },
  { code: 'D-4040', country: 'EP', date: '2024-06-03', daysLeft: 12 },
];

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const CALENDAR_YEAR = 2024;
const CALENDAR_MONTH = 5;
const SELECTED_DAY = 24;
const DUE_DAYS = [3, 28];

const ddayClassName = (daysLeft: number): string => {
  if (daysLeft <= 3) return 'pm-dday pm-dday-urgent';
  if (daysLeft <= 7) return 'pm-dday pm-dday-soon';
  return 'pm-dday pm-dday-later';
};

/** Days of the target month padded to whole weeks with neighbouring days. */
const buildMonthGrid = (year: number, month: number) => {
  const firstOfMonth = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const daysInPrevMonth = new Date(year, month - 1, 0).getDate();
  const leading = firstOfMonth.getDay();

  const cells: Array<{ day: number; inMonth: boolean }> = [];
  for (let i = leading - 1; i >= 0; i -= 1) {
    cells.push({ day: daysInPrevMonth - i, inMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ day, inMonth: true });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ day: cells.length - leading - daysInMonth + 1, inMonth: false });
  }
  return cells;
};

const PatentManagement: React.FC = () => {
  const { setHeaderContent } = useUIStore();
  const [selectedCompounds, setSelectedCompounds] = useState<string[]>([
    'A-1010',
    'B-2020',
    'D-4040',
  ]);
  const [compoundQuery, setCompoundQuery] = useState('');
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

  // ---- 문서 검색 (/api/patent-search) ----
  const [listSource, setListSource] = useState<ListSource>('search');
  const [searchResults, setSearchResults] = useState<PatentSearchItem[]>([]);
  const [searchTotal, setSearchTotal] = useState(0);
  const [searchPage, setSearchPage] = useState(1);
  const [keywordInput, setKeywordInput] = useState('');
  const [keywordTarget, setKeywordTarget] = useState<PatentSearchKeywordTarget>('officeAction');
  /** 실제로 조회에 반영된 조건. 입력 중에는 재조회하지 않는다. */
  const [appliedSearch, setAppliedSearch] = useState<{
    keyword: string;
    target: PatentSearchKeywordTarget;
    hasOpinion: boolean;
    hasAmendment: boolean;
  }>({ keyword: '', target: 'officeAction', hasOpinion: false, hasAmendment: false });
  const [onlyWithOpinion, setOnlyWithOpinion] = useState(false);
  const [onlyWithAmendment, setOnlyWithAmendment] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [selectedDocument, setSelectedDocument] = useState<PatentSearchItem | null>(null);
  /**
   * 뷰어는 선택된 문서가 있을 때만 열린다.
   * 처음 진입하면 선택이 없으므로 접힌 상태이고, 목록이 온전한 폭을 쓴다.
   */
  const isViewerOpen = selectedDocument !== null;

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
  }, [page, search]);

  useEffect(() => {
    if (listSource !== 'records') return;
    void loadPatents();
  }, [listSource, loadPatents]);

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

  const loadSearchResults = useCallback(async () => {
    setSearchLoading(true);
    setSearchError('');
    try {
      const result = await patentSearchApi.search({
        page: searchPage,
        size: PAGE_SIZE,
        // 클릭 즉시 뷰어에 본문을 그리려면 목록에서 함께 받아야 한다.
        // 검색 API에는 단건 조회 endpoint가 없어 재조회로는 가져올 수 없다.
        includeContent: true,
        filters: {
          ...(appliedSearch.hasOpinion ? { hasOpinion: true } : {}),
          ...(appliedSearch.hasAmendment ? { hasAmendment: true } : {}),
        },
        ...(appliedSearch.keyword
          ? {
              keywords: [
                { query: appliedSearch.keyword, target: appliedSearch.target },
              ],
            }
          : {}),
      });
      setSearchResults(result.items);
      setSearchTotal(result.total);
      // 목록이 바뀌면 이전 선택은 더 이상 화면에 없을 수 있다.
      setSelectedDocument(null);
    } catch (error) {
      setSearchResults([]);
      setSearchTotal(0);
      setSelectedDocument(null);
      setSearchError(getErrorMessage(error));
    } finally {
      setSearchLoading(false);
    }
  }, [appliedSearch, searchPage]);

  useEffect(() => {
    if (listSource !== 'search') return;
    void loadSearchResults();
  }, [listSource, loadSearchResults]);

  /** 상태 코드(int)를 로컬 코드 테이블 명칭으로 바꾼다. 검색 API는 id만 준다. */
  useEffect(() => {
    if (listSource !== 'search') return;
    void ensureLookups();
  }, [listSource, ensureLookups]);

  const legalStatusName = useCallback(
    (id: number | null) =>
      lookups?.legalStatuses.find((status) => status.id === id)?.status ?? null,
    [lookups],
  );

  const examStatusName = useCallback(
    (id: number | null) =>
      lookups?.examStatuses.find((status) => status.id === id)?.status ?? null,
    [lookups],
  );

  const applyDocumentSearch = () => {
    setSearchPage(1);
    setAppliedSearch({
      keyword: keywordInput.trim(),
      target: keywordTarget,
      hasOpinion: onlyWithOpinion,
      hasAmendment: onlyWithAmendment,
    });
  };

  const openDocument = (item: PatentSearchItem) => {
    if (!hasDocuments(item)) return;
    setSelectedDocument(item);
  };

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
      await loadPatents();
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

  const visibleCompounds = useMemo(() => {
    const query = compoundQuery.trim().toLowerCase();
    if (!query) return COMPOUNDS;
    return COMPOUNDS.filter((compound) => compound.code.toLowerCase().includes(query));
  }, [compoundQuery]);

  const toggleCompound = (code: string) => {
    setSelectedCompounds((current) =>
      current.includes(code)
        ? current.filter((item) => item !== code)
        : [...current, code],
    );
  };

  const calendarCells = useMemo(
    () => buildMonthGrid(CALENDAR_YEAR, CALENDAR_MONTH),
    [],
  );

  const searchColumns: TableColumnsType<PatentSearchItem> = [
    {
      title: '출원번호',
      dataIndex: 'applicationNumber',
      key: 'applicationNumber',
      width: 148,
      render: emptyDash,
    },
    {
      title: '통지일',
      dataIndex: 'actionDate',
      key: 'actionDate',
      width: 108,
      render: (value: string | null) => formatDisplayDateOnly(value),
    },
    {
      title: '명칭',
      key: 'title',
      width: 260,
      render: (_, item) => (
        <Tooltip title={item.englishTitle ?? item.koreanTitle ?? ''}>
          <span className="pm-ellipsis">
            {item.koreanTitle ?? item.englishTitle ?? '-'}
          </span>
        </Tooltip>
      ),
    },
    {
      title: '출원인',
      dataIndex: 'applicant',
      key: 'applicant',
      width: 150,
      render: (value: string | null) => (
        <Tooltip title={value ?? ''}>
          <span className="pm-ellipsis">{emptyDash(value)}</span>
        </Tooltip>
      ),
    },
    {
      title: '심사관',
      key: 'examiners',
      width: 110,
      render: (_, item) => {
        if (item.examiners.length === 0) return '-';
        const names = item.examiners.map((examiner) => examiner.name ?? '-');
        return (
          <Tooltip title={names.join(', ')}>
            <span className="pm-ellipsis">
              {names[0]}
              {names.length > 1 && ` 외 ${names.length - 1}`}
            </span>
          </Tooltip>
        );
      },
    },
    {
      title: '법적 상태',
      key: 'legalStatus',
      width: 100,
      render: (_, item) => {
        const name = legalStatusName(item.legalStatusId);
        return name ? <Tag color="blue">{name}</Tag> : emptyDash(null);
      },
    },
    {
      title: '심사 상태',
      key: 'examStatus',
      width: 100,
      render: (_, item) => {
        const name = examStatusName(item.examStatusId);
        return name ? <Tag>{name}</Tag> : emptyDash(null);
      },
    },
    {
      title: '거절이유',
      key: 'rejections',
      width: 84,
      align: 'center',
      render: (_, item) =>
        item.rejections.length > 0
          ? formatNumberWithComma(item.rejections.length)
          : '-',
    },
    {
      title: '문서',
      key: 'documents',
      width: 168,
      render: (_, item) => {
        const opinions = item.submissions.filter((s) => s.kind === 'OPINION').length;
        const amendments = item.submissions.filter((s) => s.kind === 'AMENDMENT').length;
        if (!hasDocuments(item)) {
          return <Text type="secondary" style={{ fontSize: 12 }}>없음</Text>;
        }
        return (
          <span className="pm-doc-badges">
            {(item.contentLength > 0 || item.documentPath) && <Tag color="geekblue">통지서</Tag>}
            {opinions > 0 && <Tag color="green">{`의견서${opinions > 1 ? ` ${opinions}` : ''}`}</Tag>}
            {amendments > 0 && <Tag color="gold">{`보정서${amendments > 1 ? ` ${amendments}` : ''}`}</Tag>}
          </span>
        );
      },
    },
  ];

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
            width: 96,
            align: 'center' as const,
            render: (_: unknown, record: PatentRecord) => (
              <span style={{ display: 'inline-flex', gap: 2 }}>
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
              <Text style={{ fontSize: 12 }}>{`${CALENDAR_YEAR}년 ${CALENDAR_MONTH}월`}</Text>
              <Button type="text" size="small" aria-label="이전 달" icon={<ChevronLeft size={14} />} />
              <Button type="text" size="small" aria-label="다음 달" icon={<ChevronRight size={14} />} />
            </span>
          </div>

          <div className="pm-calendar-grid">
            {WEEKDAYS.map((weekday) => (
              <div key={weekday} className="pm-calendar-weekday">{weekday}</div>
            ))}
            {calendarCells.map((cell, index) => {
              const classNames = ['pm-calendar-day'];
              if (!cell.inMonth) classNames.push('pm-calendar-day-muted');
              else if (cell.day === SELECTED_DAY) classNames.push('pm-calendar-day-selected');
              else if (DUE_DAYS.includes(cell.day)) classNames.push('pm-calendar-day-due');
              return (
                <div key={`${cell.day}-${index}`} className={classNames.join(' ')}>
                  {cell.day}
                </div>
              );
            })}
          </div>
        </section>

        <section className="pm-card">
          <div className="pm-card-header">
            <span className="pm-card-title" style={{ fontSize: 13 }}>To-do</span>
            <Button type="link" size="small" style={{ padding: 0, fontSize: 12 }}>
              더보기 <ChevronRight size={12} style={{ verticalAlign: 'middle' }} />
            </Button>
          </div>
          {DEADLINES.map((deadline) => (
            <div key={`${deadline.code}-${deadline.country}`} className="pm-deadline-row">
              <span className={ddayClassName(deadline.daysLeft)}>{`D-${deadline.daysLeft}`}</span>
              <span className="pm-deadline-label">{`${deadline.code} (${deadline.country})`}</span>
              <span className="pm-deadline-date">{deadline.date}</span>
            </div>
          ))}
        </section>

        <section className="pm-card">
          <div className="pm-card-header">
            <span className="pm-card-title">Target</span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <Input
              allowClear
              value={compoundQuery}
              onChange={(event) => setCompoundQuery(event.target.value)}
              placeholder="Target 검색"
              prefix={<Search size={14} />}
              style={{ height: 32 }}
            />
            <Button aria-label="정렬" icon={<ArrowUpDown size={14} />} style={{ height: 32, width: 36 }} />
          </div>

          <div className="pm-compound-head">
            <span />
            <span>이름</span>
            <span className="pm-compound-count">건수</span>
          </div>

          {visibleCompounds.map((compound) => {
            const checked = selectedCompounds.includes(compound.code);
            return (
              <label
                key={compound.code}
                className={`pm-compound-row${checked ? ' pm-compound-row-selected' : ''}`}
              >
                <Checkbox checked={checked} onChange={() => toggleCompound(compound.code)} />
                <span>{compound.code}</span>
                <span className="pm-compound-count">{compound.count}</span>
              </label>
            );
          })}

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
              총 {COMPOUNDS.length}건{' '}
              <Text style={{ color: 'var(--brand-primary)', fontWeight: 600, fontSize: 12 }}>
                {selectedCompounds.length}개 선택
              </Text>
            </span>
            <Pagination simple size="small" defaultCurrent={1} total={COMPOUNDS.length} pageSize={COMPOUNDS.length} />
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
              {selectedCompounds.map((code) => (
                <Tag key={code} closable onClose={() => toggleCompound(code)} style={{ margin: 0, padding: '4px 10px', borderRadius: 8 }}>
                  {code}
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
              <Segmented
                size="small"
                value={listSource}
                onChange={(value) => setListSource(value as ListSource)}
                options={[
                  { label: '문서 검색', value: 'search' },
                  { label: '관리 특허', value: 'records' },
                ]}
              />
            </span>
            <span className="pm-list-header-controls">
              {listSource === 'search' ? (
                <>
                  <Select<PatentSearchKeywordTarget>
                    value={keywordTarget}
                    onChange={setKeywordTarget}
                    style={{ width: 140, height: 34 }}
                    options={PATENT_SEARCH_KEYWORD_TARGETS.map((target) => ({
                      label: PATENT_SEARCH_KEYWORD_TARGET_LABELS[target],
                      value: target,
                    }))}
                  />
                  <Input
                    allowClear
                    value={keywordInput}
                    onChange={(event) => setKeywordInput(event.target.value)}
                    onPressEnter={applyDocumentSearch}
                    placeholder="문서 전문 키워드"
                    prefix={<Search size={14} />}
                    style={{ width: 200, height: 34 }}
                  />
                  <Button
                    icon={<Filter size={14} />}
                    style={{ height: 34 }}
                    onClick={applyDocumentSearch}
                  >
                    검색
                  </Button>
                </>
              ) : (
                <>
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
                </>
              )}
            </span>
          </div>

          {listSource === 'search' ? (
            <>
              <div className="pm-search-filters">
                <Checkbox
                  checked={onlyWithOpinion}
                  onChange={(event) => setOnlyWithOpinion(event.target.checked)}
                >
                  의견서 제출된 건만
                </Checkbox>
                <Checkbox
                  checked={onlyWithAmendment}
                  onChange={(event) => setOnlyWithAmendment(event.target.checked)}
                >
                  보정서 제출된 건만
                </Checkbox>
                <Tooltip title="검색 결과 1건은 특허가 아니라 의견제출통지서 1건입니다. 같은 특허의 통지서가 여러 건이면 여러 행으로 나옵니다.">
                  <span className="pm-search-hint">
                    <Info size={13} /> 행 = 의견제출통지서 1건
                  </span>
                </Tooltip>
              </div>

              <Table<PatentSearchItem>
                columns={searchColumns}
                dataSource={searchResults}
                rowKey={(item) => item.officeActionId ?? `${item.patentId}-${item.actionNumber}`}
                loading={searchLoading}
                size="small"
                pagination={false}
                scroll={{ x: 'max-content' }}
                rowClassName={(item) => {
                  const classNames = hasDocuments(item)
                    ? ['pm-row-clickable']
                    : ['pm-row-inert'];
                  if (
                    selectedDocument &&
                    selectedDocument.officeActionId === item.officeActionId
                  ) {
                    classNames.push('pm-row-selected');
                  }
                  return classNames.join(' ');
                }}
                onRow={(item) => ({
                  onClick: () => openDocument(item),
                })}
                locale={{
                  emptyText: searchError
                    ? `검색에 실패했습니다: ${searchError}`
                    : '조건에 맞는 문서가 없습니다.',
                }}
              />

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, fontSize: 12 }}>
                <span>총 {formatNumberWithComma(searchTotal)}건</span>
                <Pagination
                  simple
                  size="small"
                  current={searchPage}
                  total={searchTotal}
                  pageSize={PAGE_SIZE}
                  onChange={setSearchPage}
                />
              </div>
            </>
          ) : (
            <>
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
            </>
          )}
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
        }}
      />

      {/* ---- right: document viewer ---- */}
      {isViewerOpen && (
        <ResizableSidePanel label="문서 뷰어 너비 조절">
          <PatentDocumentViewer
            item={selectedDocument}
            legalStatusLabel={legalStatusName(selectedDocument?.legalStatusId ?? null)}
            examStatusLabel={examStatusName(selectedDocument?.examStatusId ?? null)}
            onClose={() => setSelectedDocument(null)}
          />
        </ResizableSidePanel>
      )}
    </div>
  );
};

export default PatentManagement;
