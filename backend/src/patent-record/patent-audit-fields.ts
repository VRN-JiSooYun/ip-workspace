/**
 * 감사 로그가 지켜보는 컬럼과, 그 값을 사람이 읽는 문자열로 옮기는 규칙.
 *
 * Prisma를 import하지 않는 순수 모듈로 둔다. 서비스가 조회를 하고 여기서는 비교와 표시만
 * 한다(patent-record-documents.ts와 같은 이유 — generated client가 딸려 오면 jest가
 * 파싱하지 못한다).
 */

/** 설명(note)은 서식 있는 긴 글이라 요약해서 남긴다. */
import { summarizeRichText } from "./rich-text";

/** 감사 로그에 남길 값. 없으면 null이고 화면은 '없음'으로 읽는다. */
export type AuditDisplayValue = string | null;

/**
 * 비교에 쓰는 행의 모양. 실제 조회 결과(LIST_INCLUDE)에서 이 모듈이 쓰는 부분만 적는다.
 * 코드 필드는 id가 아니라 include된 관계의 이름을 본다.
 */
export type AuditablePatent = {
  applicationNumber: string;
  internalRef: string | null;
  koreanTitle: string | null;
  englishTitle: string | null;
  applicationDate: Date | null;
  applicant: string | null;
  inventorLinks: Array<{
    ordinal: number;
    inventor: { inventor: string };
  }>;
  registrationNumber: string | null;
  registrationDate: string | null;
  publicationNumber: string | null;
  publicationDate: Date | null;
  intApplicationNumber: string | null;
  intApplicationDate: Date | null;
  intPublicationNumber: string | null;
  intPublicationDate: Date | null;
  parentApplicationNumber: string | null;
  exam: boolean | null;
  examDate: Date | null;
  target: string | null;
  /** 화면의 '설명'. WYSIWYG가 만든 HTML 조각이다. */
  note: string | null;
  country: { country: string } | null;
  attorney: { attorneyName: string | null } | null;
  legalStatus: { status: string | null } | null;
  examStatus: { status: string | null } | null;
};

/** `Date` → `YYYY-MM-DD`. 시각은 이 화면에서 뜻이 없어 버린다. */
const toDateText = (value: Date | null | undefined): AuditDisplayValue => {
  if (!value) return null;
  const iso = value.toISOString();
  return iso.slice(0, 10);
};

const toText = (value: string | null | undefined): AuditDisplayValue => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
};

type FieldSpec = {
  /** 화면에 쓸 이름. 모달의 라벨과 같게 유지한다. */
  label: string;
  read: (patent: AuditablePatent) => AuditDisplayValue;
  /**
   * 로그에 굳혀 둘 표시값. 없으면 read의 값을 그대로 남긴다.
   *
   * 비교는 늘 read의 값으로 한다 — 요약끼리 비교하면 앞 60자가 같은 두 문단이 '안 바뀜'이
   * 되어 이력이 사라진다. 요약은 **남길 때만** 쓴다.
   */
  display?: (value: AuditDisplayValue) => AuditDisplayValue;
};

/**
 * 지켜보는 컬럼.
 *
 * 파생 컬럼(refOrigin·refYear·refType·refSerial·refCountry)은 **일부러 넣지 않는다.**
 * internalRef 하나가 바뀌면 다섯 개가 함께 움직여 피드가 같은 사실을 여섯 번 말한다.
 * 원문인 internalRef만 남긴다.
 *
 * 화면에서 편집할 수 없는 컬럼(권리 관계 등)은 넣지 않는다. CSV 임포트로만
 * 바뀌고 임포트는 건별 요약 1행으로 따로 남기므로, 여기서 필드별로 또 남길 이유가 없다.
 * note는 예외다 — 상세 모달의 '설명'이 되면서 사람이 화면에서 고치는 값이 되었다.
 */
export const AUDITED_FIELDS: Record<string, FieldSpec> = {
  applicationNumber: {
    label: '출원번호',
    read: (patent) => toText(patent.applicationNumber),
  },
  internalRef: { label: '내부관리번호', read: (patent) => toText(patent.internalRef) },
  koreanTitle: { label: '국문 명칭', read: (patent) => toText(patent.koreanTitle) },
  englishTitle: { label: '영문 명칭', read: (patent) => toText(patent.englishTitle) },
  applicationDate: { label: '출원일', read: (patent) => toDateText(patent.applicationDate) },
  applicant: { label: '출원인', read: (patent) => toText(patent.applicant) },
  inventors: {
    label: '발명자',
    read: (patent) => toText(
      [...patent.inventorLinks]
        .sort((left, right) => left.ordinal - right.ordinal)
        .map((link) => link.inventor.inventor)
        .join(', '),
    ),
  },
  registrationNumber: {
    label: '등록번호',
    read: (patent) => toText(patent.registrationNumber),
  },
  // registration_date는 컬럼 자체가 문자열이다(형식이 제각각인 운영 시트 값을 보존한다).
  registrationDate: { label: '등록일', read: (patent) => toText(patent.registrationDate) },
  publicationNumber: {
    label: '공개번호',
    read: (patent) => toText(patent.publicationNumber),
  },
  publicationDate: { label: '공개일', read: (patent) => toDateText(patent.publicationDate) },
  intApplicationNumber: {
    label: '국제출원번호',
    read: (patent) => toText(patent.intApplicationNumber),
  },
  intApplicationDate: {
    label: '국제출원일',
    read: (patent) => toDateText(patent.intApplicationDate),
  },
  intPublicationNumber: {
    label: '국제공개번호',
    read: (patent) => toText(patent.intPublicationNumber),
  },
  intPublicationDate: {
    label: '국제공개일',
    read: (patent) => toDateText(patent.intPublicationDate),
  },
  parentApplicationNumber: {
    label: '원출원번호',
    read: (patent) => toText(patent.parentApplicationNumber),
  },
  target: { label: 'Target', read: (patent) => toText(patent.target) },
  note: {
    label: '설명',
    read: (patent) => toText(patent.note),
    // 원문은 서식이 붙은 문단이다. 피드의 `A → B` 한 줄에 태그째 밀어 넣지 않는다.
    display: (value) => summarizeRichText(value),
  },
  examDate: { label: '심사일', read: (patent) => toDateText(patent.examDate) },
  exam: {
    label: '심사청구',
    // boolean을 'true/false'로 남기면 피드에서 읽히지 않는다.
    read: (patent) => (patent.exam === null ? null : patent.exam ? '청구' : '미청구'),
  },
  // ---- 코드 필드. id가 아니라 include된 관계의 이름을 읽는다 ----
  countryId: { label: '국가', read: (patent) => toText(patent.country?.country ?? null) },
  attorneyNumber: {
    label: '대리인',
    read: (patent) => toText(patent.attorney?.attorneyName ?? null),
  },
  legalStatusId: {
    label: '법적 상태',
    read: (patent) => toText(patent.legalStatus?.status ?? null),
  },
  examStatusId: {
    label: '심사 상태',
    read: (patent) => toText(patent.examStatus?.status ?? null),
  },
};

export type AuditFieldChange = {
  field: string;
  label: string;
  beforeValue: AuditDisplayValue;
  afterValue: AuditDisplayValue;
};

/**
 * 두 행을 비교해 실제로 달라진 필드만 낸다.
 *
 * 같은 값을 다시 보내는 PATCH(사용자가 고쳤다가 되돌린 경우, 자동 저장이 두 번 나간 경우)로
 * 이력이 늘어나면 피드가 못 쓰게 된다. 그래서 dto에 담겨 왔는지가 아니라 **값이 달라졌는지**로
 * 판단한다.
 */
export const diffAuditableFields = (
  before: AuditablePatent,
  after: AuditablePatent,
): AuditFieldChange[] => {
  const changes: AuditFieldChange[] = [];
  for (const [field, spec] of Object.entries(AUDITED_FIELDS)) {
    const beforeValue = spec.read(before);
    const afterValue = spec.read(after);
    if (beforeValue === afterValue) continue;
    // 달라졌는지는 원문으로 판단하고, 남기는 것은 표시값이다.
    const toDisplay = spec.display ?? ((value: AuditDisplayValue) => value);
    changes.push({
      field,
      label: spec.label,
      beforeValue: toDisplay(beforeValue),
      afterValue: toDisplay(afterValue),
    });
  }
  return changes;
};

/** 감사 대상 컬럼 이름만. CSV 임포트가 '무엇이 바뀌었나'를 요약할 때 쓴다. */
export const auditedFieldNames = (columns: Iterable<string>): string[] => {
  const names: string[] = [];
  for (const column of columns) {
    if (AUDITED_FIELDS[column]) names.push(column);
  }
  return names;
};
