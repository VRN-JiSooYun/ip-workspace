import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Checkbox,
  Input,
  Pagination,
  Table,
  Tabs,
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
  FileText,
  Filter,
  Gavel,
  Info,
  LayoutGrid,
  MoreVertical,
  Reply,
  Search,
  Send,
  X,
} from 'lucide-react';
import PageHeaderBreadcrumb from '../components/common/PageHeaderBreadcrumb';
import { useUIStore } from '../store/useUIStore';
import './PatentManagement.css';

const { Text } = Typography;

/**
 * 특허 관리 — compound-driven patent portfolio view.
 *
 * The layout is final; the data below is placeholder. Every list here is a
 * local constant so the shape each panel expects is explicit — swap these for
 * the real API once the endpoints exist.
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

type PatentRow = {
  key: string;
  compound: string;
  country: string;
  flag: string;
  applicationNo: string;
  stage: string;
  status: string;
  statusTone: 'attention' | 'neutral';
  owner: string;
  nextDeadline: string;
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

const PATENTS: PatentRow[] = [
  { key: '1', compound: 'A-1010', country: 'KR', flag: '🇰🇷', applicationNo: '10-2023-0123456', stage: '심사', status: 'OA 대응', statusTone: 'attention', owner: '김지현', nextDeadline: '2024-05-24' },
  { key: '2', compound: 'B-2020', country: 'US', flag: '🇺🇸', applicationNo: '17/123,456', stage: '심사', status: 'OA 대응', statusTone: 'attention', owner: '이상민', nextDeadline: '2024-05-28' },
  { key: '3', compound: 'D-4040', country: 'EP', flag: '🇪🇺', applicationNo: 'EP23123456.7', stage: '출원', status: '출원 대기', statusTone: 'neutral', owner: '박준혁', nextDeadline: '2024-06-03' },
  { key: '4', compound: 'A-1010', country: 'JP', flag: '🇯🇵', applicationNo: 'JP2023-123456', stage: '등록 준비', status: '등록료 납부 대기', statusTone: 'neutral', owner: '이성민', nextDeadline: '2024-06-07' },
  { key: '5', compound: 'B-2020', country: 'CN', flag: '🇨🇳', applicationNo: 'CN202310123456.X', stage: '대응', status: '의견서 준비', statusTone: 'neutral', owner: '김지현', nextDeadline: '2024-06-05' },
  { key: '6', compound: 'D-4040', country: 'PCT', flag: '🌐', applicationNo: 'PCT/KR2023/012345', stage: '심사', status: 'SA 통지 대응', statusTone: 'attention', owner: '김지현', nextDeadline: '2024-05-30' },
  { key: '7', compound: 'A-1010', country: 'CA', flag: '🇨🇦', applicationNo: '3,123,456', stage: '출원', status: '출원 대기', statusTone: 'neutral', owner: '이상민', nextDeadline: '2024-06-10' },
  { key: '8', compound: 'B-2020', country: 'AU', flag: '🇦🇺', applicationNo: '2023901234', stage: '심사', status: 'OA 통지', statusTone: 'attention', owner: '박준혁', nextDeadline: '2024-06-12' },
];

const ACTIVE_DOCUMENT = {
  fileName: 'OA 통지서.pdf',
  country: 'KR',
  applicationNo: '10-2023-0123456',
  stage: '심사',
  documentDate: '2024-05-15',
  documentType: 'OA 통지',
  filingDate: '2023년 04월 12일',
  inventionTitle: 'AI 기반 이미지 분석 장치 및 방법',
  applicant: '(주)바이오테크',
  noticeDate: '2024년 05월 15일',
};

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
  const [isViewerOpen, setIsViewerOpen] = useState(true);

  useEffect(() => {
    setHeaderContent(<PageHeaderBreadcrumb items={[{ label: '특허 관리' }]} />);
    return () => setHeaderContent(null);
  }, [setHeaderContent]);

  const visibleCompounds = useMemo(() => {
    const query = compoundQuery.trim().toLowerCase();
    if (!query) return COMPOUNDS;
    return COMPOUNDS.filter((compound) => compound.code.toLowerCase().includes(query));
  }, [compoundQuery]);

  const visiblePatents = useMemo(() => {
    if (selectedCompounds.length === 0) return PATENTS;
    return PATENTS.filter((patent) => selectedCompounds.includes(patent.compound));
  }, [selectedCompounds]);

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

  const columns: TableColumnsType<PatentRow> = [
    { title: '화합물', dataIndex: 'compound', key: 'compound', width: 92 },
    {
      title: '국가',
      dataIndex: 'country',
      key: 'country',
      width: 90,
      render: (country: string, record) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span aria-hidden>{record.flag}</span>
          {country}
        </span>
      ),
    },
    { title: '출원번호', dataIndex: 'applicationNo', key: 'applicationNo', width: 168 },
    {
      title: '현재 단계',
      dataIndex: 'stage',
      key: 'stage',
      width: 104,
      render: (stage: string) => <Tag color="blue">{stage}</Tag>,
    },
    {
      title: '상태',
      dataIndex: 'status',
      key: 'status',
      width: 148,
      render: (status: string, record) => (
        <Tag color={record.statusTone === 'attention' ? 'orange' : 'default'}>{status}</Tag>
      ),
    },
    { title: '담당자', dataIndex: 'owner', key: 'owner', width: 90 },
    { title: '다음 마감일', dataIndex: 'nextDeadline', key: 'nextDeadline', width: 118 },
    {
      title: '',
      key: 'actions',
      width: 48,
      align: 'center',
      render: () => (
        <Button type="text" size="small" aria-label="행 작업" icon={<MoreVertical size={16} />} />
      ),
    },
  ];

  return (
    <div className={`pm-layout${isViewerOpen ? '' : ' pm-layout-viewer-closed'}`}>
      {/* ---- left: deadlines and compounds ---- */}
      <div className="pm-column">
        <section className="pm-card">
          <div className="pm-card-header">
            <span className="pm-card-title">마감 일정</span>
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
            <span className="pm-card-title" style={{ fontSize: 13 }}>다가오는 마감</span>
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
            <span className="pm-card-title">화합물 목록</span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <Input
              allowClear
              value={compoundQuery}
              onChange={(event) => setCompoundQuery(event.target.value)}
              placeholder="화합물 검색"
              prefix={<Search size={14} />}
              style={{ height: 32 }}
            />
            <Button aria-label="정렬" icon={<ArrowUpDown size={14} />} style={{ height: 32, width: 36 }} />
          </div>

          <div className="pm-compound-head">
            <span />
            <span>화합물</span>
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
      <div className="pm-column">
        <section className="pm-card">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: 19, fontWeight: 700, color: 'var(--text-primary)' }}>
              선택 화합물 <span style={{ color: 'var(--brand-primary)' }}>{selectedCompounds.length}개</span>
            </span>
            <Text type="secondary" style={{ fontSize: 12 }}>
              단계별 현황은 선택한 화합물의 합산 기준
            </Text>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {selectedCompounds.map((code) => (
                <Tag key={code} closable onClose={() => toggleCompound(code)} style={{ margin: 0, padding: '4px 10px', borderRadius: 8 }}>
                  {code}
                </Tag>
              ))}
            </div>
            <Tooltip title="화합물을 선택하지 않으면 전체 현황을 보여줍니다.">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', fontSize: 12, whiteSpace: 'nowrap' }}>
                <Info size={14} /> 선택 없음 시 전체 현황
              </span>
            </Tooltip>
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
          <div className="pm-card-header">
            <span className="pm-card-title">관련 특허 목록</span>
            <span style={{ display: 'inline-flex', gap: 8 }}>
              <Button icon={<Filter size={14} />} style={{ height: 34 }}>필터</Button>
              <Button icon={<LayoutGrid size={14} />} style={{ height: 34 }}>컬럼 설정</Button>
            </span>
          </div>

          <Table<PatentRow>
            columns={columns}
            dataSource={visiblePatents}
            size="small"
            pagination={false}
            scroll={{ x: 'max-content' }}
          />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, fontSize: 12 }}>
            <span>총 {visiblePatents.length}건</span>
            <Pagination simple size="small" defaultCurrent={1} total={visiblePatents.length} pageSize={visiblePatents.length || 1} />
          </div>
        </section>
      </div>

      {/* ---- right: document viewer ---- */}
      {isViewerOpen && (
        <div className="pm-column">
          <section className="pm-card">
            <div className="pm-card-header">
              <span className="pm-card-title">문서 뷰어</span>
              <Button icon={<X size={14} />} onClick={() => setIsViewerOpen(false)} style={{ height: 32 }}>
                뷰어 닫기
              </Button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <FileText size={20} style={{ color: 'var(--brand-primary)' }} />
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                {ACTIVE_DOCUMENT.fileName}
              </span>
            </div>

            <div className="pm-viewer-meta" style={{ marginBottom: 6 }}>
              <span>국가 <span className="pm-viewer-meta-value">{ACTIVE_DOCUMENT.country}</span></span>
              <span className="pm-viewer-divider">|</span>
              <span>출원번호 <span className="pm-viewer-meta-value">{ACTIVE_DOCUMENT.applicationNo}</span></span>
              <span className="pm-viewer-divider">|</span>
              <span>단계 <span className="pm-viewer-meta-value">{ACTIVE_DOCUMENT.stage}</span></span>
            </div>
            <div className="pm-viewer-meta" style={{ marginBottom: 12 }}>
              <span>문서일 <span className="pm-viewer-meta-value">{ACTIVE_DOCUMENT.documentDate}</span></span>
              <span className="pm-viewer-divider">|</span>
              <span>문서구분 <span className="pm-viewer-meta-value">{ACTIVE_DOCUMENT.documentType}</span></span>
            </div>

            <Tabs
              defaultActiveKey="preview"
              items={[
                {
                  key: 'preview',
                  label: '미리보기',
                  children: (
                    <div className="pm-viewer-preview">
                      <div style={{ textAlign: 'center', marginBottom: 18 }}>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          특허청 Korean Intellectual Property Office
                        </Text>
                        <div style={{ fontSize: 17, fontWeight: 700, marginTop: 10, color: 'var(--text-primary)' }}>
                          의견제출통지서
                        </div>
                      </div>

                      <div className="pm-doc-field">
                        <span className="pm-doc-field-label">출원번호</span>
                        <span className="pm-doc-field-value">{ACTIVE_DOCUMENT.applicationNo}</span>
                      </div>
                      <div className="pm-doc-field">
                        <span className="pm-doc-field-label">출원일</span>
                        <span className="pm-doc-field-value">{ACTIVE_DOCUMENT.filingDate}</span>
                      </div>
                      <div className="pm-doc-field">
                        <span className="pm-doc-field-label">발명의 명칭</span>
                        <span className="pm-doc-field-value">{ACTIVE_DOCUMENT.inventionTitle}</span>
                      </div>
                      <div className="pm-doc-field">
                        <span className="pm-doc-field-label">출원인</span>
                        <span className="pm-doc-field-value">{ACTIVE_DOCUMENT.applicant}</span>
                      </div>
                      <div className="pm-doc-field">
                        <span className="pm-doc-field-label">통지일</span>
                        <span className="pm-doc-field-value">{ACTIVE_DOCUMENT.noticeDate}</span>
                      </div>

                      <div style={{ borderTop: '1px solid var(--border-color)', margin: '16px 0' }} />

                      <p style={{ fontSize: 12, lineHeight: 1.8, color: 'var(--text-primary)' }}>
                        이 출원에 대하여 심사한 결과 다음과 같은 거절이유가 있어 특허법 제63조에 따라
                        의견제출을 통지합니다.
                      </p>

                      <div style={{ fontSize: 13, fontWeight: 700, margin: '16px 0 8px', color: 'var(--text-primary)' }}>
                        1. 거절이유
                      </div>
                      <p style={{ fontSize: 12, lineHeight: 1.8, color: 'var(--text-primary)' }}>
                        가. 신규성 및 진보성 관련 거절이유
                      </p>
                      <p style={{ fontSize: 12, lineHeight: 1.8, color: 'var(--text-secondary)' }}>
                        선행기술문헌 1, 2에 의해 본 발명은 신규성이 부정되거나 진보성이 부정될 수 있습니다.
                      </p>
                      <p style={{ fontSize: 12, lineHeight: 1.8, color: 'var(--text-primary)' }}>
                        나. 기재불비 관련 거절이유
                      </p>
                      <p style={{ fontSize: 12, lineHeight: 1.8, color: 'var(--text-secondary)' }}>
                        청구범위의 일부 기재가 불분명하여 명확성을 결여하고 있습니다.
                      </p>
                    </div>
                  ),
                },
                {
                  key: 'info',
                  label: '정보',
                  children: (
                    <div className="pm-viewer-preview">
                      <div className="pm-doc-field">
                        <span className="pm-doc-field-label">문서명</span>
                        <span className="pm-doc-field-value">{ACTIVE_DOCUMENT.fileName}</span>
                      </div>
                      <div className="pm-doc-field">
                        <span className="pm-doc-field-label">문서구분</span>
                        <span className="pm-doc-field-value">{ACTIVE_DOCUMENT.documentType}</span>
                      </div>
                      <div className="pm-doc-field">
                        <span className="pm-doc-field-label">문서일</span>
                        <span className="pm-doc-field-value">{ACTIVE_DOCUMENT.documentDate}</span>
                      </div>
                      <div className="pm-doc-field">
                        <span className="pm-doc-field-label">단계</span>
                        <span className="pm-doc-field-value">{ACTIVE_DOCUMENT.stage}</span>
                      </div>
                    </div>
                  ),
                },
              ]}
            />
          </section>
        </div>
      )}
    </div>
  );
};

export default PatentManagement;
