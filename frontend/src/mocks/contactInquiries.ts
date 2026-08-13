import { withBasePath } from '../config/basePath';

export type ContactCategory =
  | 'Dashboard'
  | 'Compounds'
  | 'Design'
  | 'Synthesis'
  | 'Documents'
  | 'Tools'
  | '통합검색'
  | '모니터링'
  | '개발 진행 현황'
  | '기타';

export type ContactInquiryType = 'NEW' | 'CHANGE' | 'BUG' | 'QUESTION';
export type ContactInquiryStatus = 'PROCESSING' | 'ON_HOLD' | 'COMPLETED';
export type ContactAuthorCheck = 'UNCHECKED' | 'RE_REQUESTED' | 'CONFIRMED';

export type ContactInquiry = {
  id: string;
  sequence: number;
  category: ContactCategory;
  createdAt: string;
  type: ContactInquiryType;
  authorName: string;
  contentHtml: string;
  status: ContactInquiryStatus;
  appliedVersion?: string;
  commentHtml?: string;
  commenterName?: string;
  commentedAt?: string;
  authorCheck: ContactAuthorCheck;
  canReply: boolean;
};

export const CONTACT_CATEGORY_OPTIONS: ContactCategory[] = [
  'Dashboard',
  'Compounds',
  'Design',
  'Synthesis',
  'Documents',
  'Tools',
  '통합검색',
  '모니터링',
  '개발 진행 현황',
  '기타',
];

export const CONTACT_TYPE_LABELS: Record<ContactInquiryType, string> = {
  NEW: '신규',
  CHANGE: '수정',
  BUG: '버그',
  QUESTION: '문의',
};

export const CONTACT_STATUS_LABELS: Record<ContactInquiryStatus, string> = {
  PROCESSING: '처리중',
  ON_HOLD: '보류',
  COMPLETED: '완료',
};

export const CONTACT_AUTHOR_CHECK_LABELS: Record<ContactAuthorCheck, string> = {
  UNCHECKED: '미확인',
  RE_REQUESTED: '재요청',
  CONFIRMED: '확인',
};

export const contactInquiryMocks: ContactInquiry[] = [
  {
    id: 'contact-5',
    sequence: 5,
    category: '통합검색',
    createdAt: '2026-07-21T09:20:00+09:00',
    type: 'CHANGE',
    authorName: '박창인',
    contentHtml: '<p>필터 조건을 변경한 뒤에도 선택값이 유지되도록 수정이 필요합니다.</p>',
    status: 'ON_HOLD',
    authorCheck: 'UNCHECKED',
    canReply: true,
  },
  {
    id: 'contact-4',
    sequence: 4,
    category: 'Design',
    createdAt: '2026-07-18T15:42:00+09:00',
    type: 'NEW',
    authorName: '박창인',
    contentHtml: [
      '<p><strong>SAR table 개선 요청</strong></p>',
      '<ul><li>테이블 셀 원래대로 연하게 표시</li><li>이미지 사이즈 사용자 조절</li><li>이미지 기울기 조절</li></ul>',
      `<p><img src="${withBasePath('sidebar-mini-logo.svg')}" alt="첨부 화면 예시" /></p>`,
    ].join(''),
    status: 'PROCESSING',
    appliedVersion: '2.1.8',
    commentHtml: '<p>요청 내용을 확인했습니다. 화면 크기별 동작을 검토하고 있습니다.</p>',
    commenterName: '관리자',
    commentedAt: '2026-07-19T10:10:00+09:00',
    authorCheck: 'RE_REQUESTED',
    canReply: true,
  },
  {
    id: 'contact-3',
    sequence: 3,
    category: 'Compounds',
    createdAt: '2026-07-12T11:10:00+09:00',
    type: 'BUG',
    authorName: '문태훈',
    contentHtml: '<p>Chemical space에서 축 설정이 간헐적으로 적용되지 않습니다.</p>',
    status: 'COMPLETED',
    appliedVersion: '2.1.5',
    commentHtml: '<p>축 설정 동기화 문제를 수정했습니다.</p>',
    commenterName: '관리자',
    commentedAt: '2026-07-14T16:30:00+09:00',
    authorCheck: 'CONFIRMED',
    canReply: false,
  },
  {
    id: 'contact-2',
    sequence: 2,
    category: 'Dashboard',
    createdAt: '2026-07-08T13:25:00+09:00',
    type: 'QUESTION',
    authorName: '김연구',
    contentHtml: '<p>Dashboard 통계가 갱신되는 기준 시간을 알고 싶습니다.</p>',
    status: 'PROCESSING',
    authorCheck: 'UNCHECKED',
    canReply: true,
  },
  {
    id: 'contact-1',
    sequence: 1,
    category: 'Tools',
    createdAt: '2026-07-02T09:05:00+09:00',
    type: 'NEW',
    authorName: '이보라',
    contentHtml: '<p>Reaction Site Predictor 결과 다운로드 기능을 추가해주세요.</p>',
    status: 'COMPLETED',
    appliedVersion: '2.1.3',
    commentHtml: '<p>결과 CSV 다운로드 기능을 추가했습니다.</p>',
    commenterName: '관리자',
    commentedAt: '2026-07-04T14:00:00+09:00',
    authorCheck: 'CONFIRMED',
    canReply: false,
  },
];
