/**
 * harness용 가짜 workspace 상태.
 *
 * 실제 화면은 AuthGate 안에 있어 dev 브라우저에서 열 수 없다. 패널의 '생김새'
 * (높이를 채우는지, 스크롤이 패널 안에서만 생기는지, 좁아졌을 때 깨지지 않는지)는
 * 데이터 없이도 확인할 수 있으므로, 컨텍스트만 가짜로 채워 실제 패널을 띄운다.
 *
 * API는 부르지 않는다. usePatentWorkspaceState가 반환하는 모양만 그대로 맞춰 채운다.
 */

import type { PatentWorkspaceState } from '../hooks/usePatentWorkspaceState';
import type {
  PatentRecord,
  PatentScheduleEvent,
  PatentScheduleResult,
  PatentStageSummary,
} from '../services/patentRecordApi';
import type { PatentSearchItem } from '../services/patentSearchApi';
import { buildMonthGrid, toLocalDateKey } from '../utils/patentCalendar';

const COUNTRIES = [
  { id: 1, country: 'KR' },
  { id: 2, country: 'US' },
  { id: 3, country: 'EP' },
  { id: 4, country: 'JP' },
  { id: 5, country: 'CN' },
];

const LEGAL_STATUSES = [
  { id: 1, status: '출원' },
  { id: 2, status: '등록' },
  { id: 3, status: '거절' },
];

const EXAM_STATUSES = [
  { id: 1, status: '심사청구' },
  { id: 2, status: '의견제출통지' },
];

const TARGET_NAMES = [
  'EGFR', 'KRAS G12C', 'BTK', 'JAK1', 'PARP1', 'CDK4/6', 'SHP2',
  'PD-L1', 'HER2', 'ALK', 'ROS1', 'MET', 'FGFR3', 'IDH1', 'BCL-2',
];

const makeRecord = (index: number): PatentRecord => {
  const country = COUNTRIES[index % COUNTRIES.length];
  const year = 2019 + (index % 7);
  return {
    id: index + 1,
    countryId: country.id,
    internalRef: index % 9 === 0 ? `RAW-${index}` : `P${year}-${String(index + 1).padStart(4, '0')}`,
    // 9번째마다 규칙 외 번호로 둬서 '규칙 외' 태그가 보이는지 확인한다.
    refOrigin: index % 9 === 0 ? null : 'VRN',
    refYear: year,
    refType: 'P',
    refSerial: index + 1,
    refCountry: country.country,
    koreanTitle: `${TARGET_NAMES[index % TARGET_NAMES.length]} 억제제 및 이를 포함하는 약학 조성물`,
    englishTitle: `${TARGET_NAMES[index % TARGET_NAMES.length]} inhibitor and pharmaceutical composition comprising same`,
    applicationNumber: `${country.country}${year}${String(index * 7919 % 1000000).padStart(6, '0')}`,
    applicationDate: `${year}-${String((index % 12) + 1).padStart(2, '0')}-14`,
    applicant: index % 3 === 0 ? '보로노이 주식회사' : 'Voronoi Inc.',
    attorneyNumber: 100 + (index % 4),
    registrationNumber: index % 4 === 0 ? `10-${2200000 + index}` : null,
    registrationDate: index % 4 === 0 ? `${year + 2}-03-02` : null,
    publicationNumber: null,
    publicationDate: null,
    intApplicationNumber: null,
    intApplicationDate: null,
    intPublicationNumber: null,
    intPublicationDate: null,
    parentApplicationNumber: null,
    legalStatusId: LEGAL_STATUSES[index % LEGAL_STATUSES.length].id,
    examStatusId: EXAM_STATUSES[index % EXAM_STATUSES.length].id,
    exam: true,
    examDate: null,
    target: TARGET_NAMES[index % TARGET_NAMES.length],
    country,
    attorney: { attorneyNumber: 100 + (index % 4), attorneyName: `대리인 ${(index % 4) + 1}` },
    legalStatus: LEGAL_STATUSES[index % LEGAL_STATUSES.length],
    examStatus: EXAM_STATUSES[index % EXAM_STATUSES.length],
    documentCount: index % 3,
    // 감사 로그 도입과 함께 붙은 컬럼. 상세 모달 바닥의 '만듦/업데이트'가 이 값을 쓴다.
    createdAt: `${year}-01-05T02:00:00.000Z`,
    updatedAt: '2026-08-20T07:30:00.000Z',
  };
};

const STAGE_SUMMARY: PatentStageSummary = {
  total: 312,
  groups: [
    {
      code: 'FILING', label: '출원', ordinal: 1, count: 96,
      stages: [
        { code: 'FILED', label: '출원 완료', description: null, scope: null, active: true, count: 62 },
        { code: 'PCT', label: 'PCT 국제출원', description: null, scope: 'PCT', active: true, count: 34 },
      ],
    },
    {
      code: 'EXAM', label: '심사', ordinal: 2, count: 118,
      stages: [
        { code: 'EXAM_REQ', label: '심사청구', description: null, scope: null, active: true, count: 71 },
        { code: 'OA', label: '의견제출통지', description: null, scope: null, active: true, count: 47 },
      ],
    },
    {
      code: 'REGISTERED', label: '등록', ordinal: 3, count: 74,
      stages: [
        { code: 'REG', label: '등록 완료', description: null, scope: null, active: true, count: 74 },
      ],
    },
    {
      code: 'CLOSED', label: '종료', ordinal: 4, count: 18,
      stages: [
        { code: 'REJECTED', label: '거절 확정', description: null, scope: null, active: true, count: 11 },
        { code: 'WITHDRAWN', label: '취하', description: null, scope: null, active: true, count: 7 },
      ],
    },
  ],
  unmapped: {
    groupCode: 'UNMAPPED',
    count: 6,
    statuses: [{ legalStatusId: null, status: null, count: 6 }],
  },
};

const buildSchedule = (year: number, month: number): PatentScheduleResult => {
  const days = buildMonthGrid(year, month).filter((cell) => cell.inMonth);
  const events: PatentScheduleEvent[] = days
    .filter((_, index) => index % 4 === 0)
    .map((cell, index) => ({
      patentId: index + 1,
      internalRef: `P${year}-${String(index + 1).padStart(4, '0')}`,
      applicationNumber: `KR${year}00${index}`,
      title: `${TARGET_NAMES[index % TARGET_NAMES.length]} 억제제`,
      country: 'KR',
      target: TARGET_NAMES[index % TARGET_NAMES.length],
      type: index % 2 === 0 ? 'APPLICATION' : 'EXAM',
      label: index % 2 === 0 ? '출원일' : '심사 기한',
      date: cell.date,
    }));

  return {
    year,
    month,
    events,
    todos: days.filter((_, index) => index % 5 === 0).map((cell, index) => ({
      todoId: index + 1,
      patentId: index + 1,
      internalRef: `P${year}-${String(index + 1).padStart(4, '0')}`,
      applicationNumber: `KR${year}00${index}`,
      patentTitle: `${TARGET_NAMES[index % TARGET_NAMES.length]} 억제제`,
      title: index % 2 === 0 ? '의견서 제출' : '보정서 검토',
      description: '대리인 초안 회신 확인',
      country: 'KR',
      target: TARGET_NAMES[index % TARGET_NAMES.length],
      dueDate: cell.date,
    })),
    todoTotal: 37,
  };
};

/** 문서 뷰어 패널을 확인하려면 고른 문서가 있어야 한다. */
const DOCUMENT_ITEM: PatentSearchItem = {
  officeActionId: 9001,
  relevanceScore: null,
  adminId: 1,
  content: [
    '# 의견제출통지서',
    '',
    '【출원번호】24889126.9',
    '【통지일자】2025-04-14',
    '',
    '【거절이유】',
    '이 출원의 청구항 1 내지 5에 기재된 발명은 그 출원 전에 국내에서 반포된 간행물에',
    '게재된 발명(인용발명 1)에 의하여 통상의 기술자가 쉽게 발명할 수 있는 것이므로',
    '특허법 제29조 제2항의 규정에 의하여 특허를 받을 수 없습니다.',
    '',
    '【인용발명】',
    '1. 한국공개특허 제10-2019-0123456호',
    '',
    '【의견제출기한】',
    '이 통지서를 받은 날부터 2개월 이내',
  ].join('\n'),
  contentLength: 320,
  documentPath: 'http://example.invalid/oa/2025/24889126.9_의견제출통지서_2025-04-14.pdf',
  actionDate: '2025-04-14',
  action: '의견제출통지서',
  actionNumber: '9-5-2025-000123456',
  patentId: 1,
  applicationNumber: '24889126.9',
  koreanTitle: 'EGFR 억제제 및 이를 포함하는 약학 조성물',
  englishTitle: 'EGFR inhibitor and pharmaceutical composition comprising same',
  applicant: '보로노이 주식회사',
  legalStatusId: 1,
  legalStatus: '출원',
  examStatusId: 2,
  exam: true,
  examiners: [
    { id: 1, office: '특허청', bureau: '화학생명기술심사국', department: '약품화학심사과', name: '홍길동' },
  ],
  submissions: [
    { id: 11, typeCode: 1, kind: 'OPINION', content: '【의견서】\n인용발명 1과의 구조적 차이를 설명합니다.', contentLength: 90, documentPath: null },
  ],
  rejections: [
    { rejectionId: 1, claim: '1-5', lawType: 1, article: 29, paragraph: 2, subParagraph: null },
  ],
  patent: null,
};

/**
 * 상태를 State로 캐스팅한다. 훅의 반환 타입은 필드가 50개 남짓이라 전부 손으로 채우면
 * 실제 훅이 바뀔 때마다 harness가 먼저 깨진다. 여기서는 '패널이 그리는 데 필요한 것'만
 * 채우고 나머지는 no-op으로 둔다.
 */
export const buildMockWorkspaceState = (
  calendarMonth: { year: number; month: number },
  overrides: Partial<PatentWorkspaceState> = {},
): PatentWorkspaceState => {
  const today = new Date();
  const noop = () => undefined;
  const schedule = buildSchedule(calendarMonth.year, calendarMonth.month);

  return {
    canManage: true,

    selectedTargets: ['EGFR'],
    applySelectedTargets: noop,

    schedule,
    scheduleLoading: false,
    scheduleError: '',
    calendarMonth,
    calendarCells: buildMonthGrid(calendarMonth.year, calendarMonth.month),
    selectedCalendarDate: toLocalDateKey(today),
    setSelectedCalendarDate: noop,
    moveCalendarMonth: noop,
    eventsByDate: schedule.events.reduce((grouped, event) => {
      grouped.set(event.date, [...(grouped.get(event.date) ?? []), event]);
      return grouped;
    }, new Map<string, PatentScheduleEvent[]>()),
    getHolidayName: () => null,
    todayKey: toLocalDateKey(today),

    lookups: {
      countries: COUNTRIES,
      attorneys: [100, 101, 102, 103].map((attorneyNumber, index) => ({
        attorneyNumber,
        attorneyName: `대리인 ${index + 1}`,
      })),
      legalStatuses: LEGAL_STATUSES,
      examStatuses: EXAM_STATUSES,
      targets: TARGET_NAMES.map((target, index) => ({ id: index + 1, target })),
    },
    oaLookups: {
      countries: COUNTRIES,
      legalStatuses: LEGAL_STATUSES,
      examStatuses: EXAM_STATUSES,
    },
    oaLookupsLoading: false,
    listFilters: {},
    applyListFilters: noop,
    stageSummary: STAGE_SUMMARY,
    stagesLoading: false,
    stagesError: '',
    stageGroupTiles: [],
    activeStageGroup: null,
    activeStageLabel: '',
    applyStageGroup: noop,
    toggleStageGroup: noop,
    stageCodeLabel: undefined,
    isStageRowActive: () => false,
    pickStageRow: noop,

    patents: Array.from({ length: 20 }, (_, index) => makeRecord(index)),
    total: 312,
    page: 1,
    setPage: noop,
    search: 'EGFR',
    applySearch: noop,
    listLoading: false,
    listError: '',

    isModalOpen: false,
    editingRecord: null,
    submitting: false,
    openCreateModal: noop,
    openEditModal: noop,
    closeRecordModal: noop,
    handleSubmit: async () => undefined,
    confirmDelete: noop,
    isImportOpen: false,
    setIsImportOpen: noop,
    handleImportApplied: noop,

    todoPatent: null,
    setTodoPatent: noop,
    reloadSchedule: async () => undefined,

    documentPatent: makeRecord(0),
    openDocuments: noop,
    documentItems: [DOCUMENT_ITEM],
    activeDocumentId: DOCUMENT_ITEM.officeActionId,
    setActiveDocumentId: noop,
    activeDocument: DOCUMENT_ITEM,

    ...overrides,
  } as PatentWorkspaceState;
};
