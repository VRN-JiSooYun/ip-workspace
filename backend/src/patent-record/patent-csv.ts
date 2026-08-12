/**
 * Google Sheets에서 내보낸 CSV를 다루기 위한 파서와 컬럼 정의.
 *
 * 의존성을 늘리지 않고 RFC 4180을 따른다. Sheets export에서 실제로 나오는
 * BOM, 따옴표로 감싼 값 안의 쉼표·개행, CRLF를 모두 처리한다.
 */

export type PatentCsvField =
  | "internalRef"
  | "target"
  | "attorneyName"
  | "applicationNumber"
  | "applicationDate"
  | "country"
  | "koreanTitle"
  | "applicant"
  | "inventors"
  | "legalStatus"
  | "statusNote"
  | "todoDueDate"
  | "relationType"
  | "parentApplicationNumber"
  | "publicationDate"
  | "publicationNumber"
  | "registrationNumber"
  | "registrationDate"
  | "licenseAgreement"
  | "note"
  | "rightsChange"
  | "shareAgreement"
  | "expectedExpiryDate"
  | "englishTitle"
  | "attorneyNumber"
  | "intApplicationNumber"
  | "intApplicationDate"
  | "intPublicationNumber"
  | "intPublicationDate"
  | "examStatus"
  | "exam"
  | "examDate";

export type ColumnSpec = {
  field: PatentCsvField;
  /** 템플릿에 쓰는 대표 헤더. */
  header: string;
  /** 허용하는 다른 표기. 비교는 공백 제거 + 소문자로 한다. */
  aliases: string[];
};

/**
 * 순서와 대표 헤더는 IP팀 운영 시트를 그대로 따른다. 시트를 복사해 붙여도
 * 컬럼이 어긋나지 않게 하려는 것이다.
 *
 * 앞 23개가 시트의 컬럼이고, 뒤 9개는 시트에는 없지만 DB에 이미 있는 항목이라
 * CSV로도 계속 넣을 수 있게 뒤에 붙여 두었다.
 *
 * 헤더를 바꿀 때는 기존 표기를 반드시 alias로 남긴다. 이 목록이 템플릿과 import
 * 헤더 인식을 동시에 담당하므로, alias가 없으면 예전에 받아 둔 CSV가 그대로
 * 무시된다.
 */
export const PATENT_CSV_COLUMNS: ColumnSpec[] = [
  {
    field: "internalRef",
    header: "Our Ref.",
    aliases: [
      "ourref",
      "our_ref",
      "내부관리번호",
      "internalref",
      "internal_ref",
      "관리번호",
      "ref",
      "ref번호",
    ],
  },
  { field: "target", header: "Target", aliases: ["target", "타겟"] },
  {
    field: "attorneyName",
    header: "대리인",
    aliases: ["attorneyname", "attorney_name", "대리인명"],
  },
  {
    field: "applicationNumber",
    header: "출원번호",
    aliases: ["applicationnumber", "application_number"],
  },
  {
    field: "applicationDate",
    header: "출원일",
    aliases: ["applicationdate", "application_date"],
  },
  { field: "country", header: "출원국", aliases: ["country", "국가"] },
  {
    field: "koreanTitle",
    header: "발명의 명칭",
    aliases: ["koreantitle", "korean_title", "국문명칭", "국문 명칭"],
  },
  { field: "applicant", header: "출원인", aliases: ["applicant"] },
  {
    field: "inventors",
    header: "발명자",
    aliases: ["inventors", "inventor", "발명자명"],
  },
  {
    field: "legalStatus",
    header: "현재 Status",
    aliases: ["currentstatus", "status", "법적상태", "legalstatus", "legal_status", "법적 상태"],
  },
  {
    field: "statusNote",
    header: "Status 설명",
    aliases: ["statusnote", "status_note", "status설명", "상태설명"],
  },
  {
    field: "todoDueDate",
    header: "To-do 마감일",
    aliases: ["tododuedate", "todo_due_date", "todo마감일", "마감일"],
  },
  {
    field: "relationType",
    header: "관계(분할/계속)",
    aliases: [
      "relationtype",
      "relation_type",
      "관계",
      "관계(분할/계속)",
      "분할/계속",
    ],
  },
  {
    field: "parentApplicationNumber",
    header: "관련특허",
    aliases: [
      "relatedpatent",
      "원출원번호",
      "parentapplicationnumber",
      "parent_application_number",
    ],
  },
  {
    field: "publicationDate",
    header: "공개일",
    aliases: ["publicationdate", "publication_date"],
  },
  {
    field: "publicationNumber",
    header: "공개번호",
    aliases: ["publicationnumber", "publication_number"],
  },
  {
    field: "registrationNumber",
    header: "등록번호",
    aliases: ["registrationnumber", "registration_number"],
  },
  {
    field: "registrationDate",
    header: "등록일",
    aliases: ["registrationdate", "registration_date"],
  },
  {
    field: "licenseAgreement",
    header: "실시권 계약",
    aliases: ["licenseagreement", "license_agreement", "실시권계약", "실시권"],
  },
  { field: "note", header: "기타", aliases: ["note", "비고", "etc"] },
  {
    field: "rightsChange",
    header: "권리관계 변경",
    aliases: ["rightschange", "rights_change", "권리관계변경", "권리관계"],
  },
  {
    field: "shareAgreement",
    header: "지분약정(지분율변경) 기존 출원인",
    aliases: [
      "shareagreement",
      "share_agreement",
      "지분약정",
      "지분율변경",
      "기존출원인",
    ],
  },
  {
    field: "expectedExpiryDate",
    header: "(예상) 만료일",
    aliases: [
      "expectedexpirydate",
      "expected_expiry_date",
      "예상만료일",
      "만료일",
    ],
  },

  // ---- 시트에는 없지만 DB에 있는 항목 ----
  {
    field: "englishTitle",
    header: "영문명칭",
    aliases: ["englishtitle", "english_title", "영문 명칭"],
  },
  {
    field: "attorneyNumber",
    header: "대리인번호",
    aliases: ["attorneynumber", "attorney_number", "대리인 번호"],
  },
  {
    field: "intApplicationNumber",
    header: "국제출원번호",
    aliases: ["intapplicationnumber", "int_application_number"],
  },
  {
    field: "intApplicationDate",
    header: "국제출원일",
    aliases: ["intapplicationdate", "int_application_date"],
  },
  {
    field: "intPublicationNumber",
    header: "국제공개번호",
    aliases: ["intpublicationnumber", "int_publication_number"],
  },
  {
    field: "intPublicationDate",
    header: "국제공개일",
    aliases: ["intpublicationdate", "int_publication_date"],
  },
  {
    field: "examStatus",
    header: "심사상태",
    aliases: ["examstatus", "exam_status", "심사 상태"],
  },
  { field: "exam", header: "심사청구", aliases: ["exam", "심사 청구"] },
  { field: "examDate", header: "심사일", aliases: ["examdate", "exam_date"] },
];

const normalizeHeader = (value: string): string =>
  value.replace(/\s+/g, "").toLowerCase();

const HEADER_LOOKUP = new Map<string, PatentCsvField>();
for (const column of PATENT_CSV_COLUMNS) {
  HEADER_LOOKUP.set(normalizeHeader(column.header), column.field);
  for (const alias of column.aliases) {
    HEADER_LOOKUP.set(normalizeHeader(alias), column.field);
  }
}

export const resolveHeaderField = (
  header: string,
): PatentCsvField | undefined => HEADER_LOOKUP.get(normalizeHeader(header));

/** 쉼표·따옴표·개행이 든 값을 RFC 4180대로 감싼다. */
const escapeCsvCell = (value: string): string =>
  /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

/** 빈 템플릿 CSV. Excel이 UTF-8로 열도록 BOM을 붙인다. */
export const buildTemplateCsv = (): string =>
  `﻿${PATENT_CSV_COLUMNS.map((column) => escapeCsvCell(column.header)).join(",")}\n`;

/**
 * RFC 4180 파싱. 따옴표 안의 쉼표·개행·이스케이프된 따옴표("")를 보존한다.
 * 반환값은 행 배열이며, 완전히 빈 행은 제외한다.
 */
export const parseCsv = (input: string): string[][] => {
  const text = input.replace(/^﻿/, "").replace(/\r\n/g, "\n");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      row.push(cell);
      cell = "";
      rows.push(row);
      row = [];
    } else {
      cell += char;
    }
  }

  // 마지막 줄에 개행이 없을 수 있다.
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((cells) => cells.some((value) => value.trim() !== ""));
};

/** `2026-08-10`, `2026.08.10`, `2026/08/10`, `20260810`을 모두 받는다. */
export const parseCsvDate = (value: string): Date | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const compact = /^(\d{4})(\d{2})(\d{2})$/.exec(trimmed);
  const delimited = /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/.exec(trimmed);
  const match = compact ?? delimited;
  if (!match) return null;

  const [, year, month, day] = match;
  // UTC 기준으로 만들어 시간대에 따라 하루가 밀리지 않게 한다.
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (Number.isNaN(date.getTime())) return null;
  if (date.getUTCMonth() !== Number(month) - 1) return null; // 2월 30일 등
  return date;
};

const TRUE_VALUES = new Set(["y", "yes", "true", "o", "1", "예", "청구", "함"]);
const FALSE_VALUES = new Set([
  "n",
  "no",
  "false",
  "x",
  "0",
  "아니오",
  "미청구",
  "안함",
]);

/** 불리언으로 못 읽으면 undefined를 돌려 호출 쪽에서 오류 행으로 만들게 한다. */
export const parseCsvBoolean = (value: string): boolean | null | undefined => {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  if (TRUE_VALUES.has(trimmed)) return true;
  if (FALSE_VALUES.has(trimmed)) return false;
  return undefined;
};
