/**
 * 통지 건을 타임라인 항목(문서 단위)으로 펼치는 규칙.
 *
 * 타임라인과 뷰어 본문이 같은 목록을 봐야 하므로 조립은 여기 한 곳에서 한다 — 두 곳에서
 * 각자 만들면 노드 key가 어긋나 "선택한 문서와 보이는 문서"가 달라진다.
 *
 * React를 import하지 않는 순수 모듈로 둔다.
 */

import type { PatentSearchItem, PatentSearchSubmission } from '../../services/patentSearchApi';

/** 문서 한 건의 PDF 원본. */
export type PdfSource = { label: string; path: string };

/** 문서 날짜를 어디서 얻었는지. 화면에서 신뢰도를 밝히는 데 쓴다. */
export type DocumentDateSource = 'actionDate' | 'fileName';

export type PatentDocumentNode = {
  /** 이 통지 건 안에서 유일한 key. 보고 있던 문서를 기억하는 데 쓴다. */
  key: string;
  label: string;
  /** 통지서 / 의견서 / 보정서 / 그 외. 타임라인의 점 모양을 가른다. */
  kind: 'OFFICE_ACTION' | 'OPINION' | 'AMENDMENT' | 'OTHER' ;
  sources: PdfSource[];
  /** YYYY-MM-DD. 알 수 없으면 null. */
  date: string | null;
  dateSource: DocumentDateSource | null;
  /** 목록 인덱스에는 없고 선택 문서 지연 조회가 끝나면 채워지는 추출 본문. */
  content: string | null;
};

/** 타임라인에 놓이는 항목 하나 = 어느 통지 건의 어느 문서. */
export type PatentDocumentEntry = {
  item: PatentSearchItem;
  node: PatentDocumentNode;
};

/**
 * `.../1020230184208_보정서_20240701.pdf` → `2024-07-01`.
 *
 * 의견서·보정서에는 날짜 컬럼이 없다(`response` 테이블에도, 외부 검색 API 응답에도).
 * 파일명 끝의 `_YYYYMMDD`가 유일한 출처라 거기서 읽는다.
 *
 * 8자리 숫자를 아무 데서나 줍지 않는다 — 파일명 앞쪽 출원번호(`1020230184208`)가
 * 13자리 숫자라 느슨한 정규식이면 그 안에서 잘못 잡는다. 그래서 구분자(`_`·`-`·`.`)로
 * 시작하고 확장자 바로 앞에서 끝나는 8자리만 본다. 실제로 존재하는 날짜인지도 확인해
 * `..._99999999.pdf` 같은 값을 날짜로 착각하지 않는다.
 */
export const parseDateFromDocumentPath = (
  documentPath: string | null | undefined,
): string | null => {
  if (!documentPath) return null;

  const lastSegment = documentPath.split('/').pop();
  if (!lastSegment) return null;
  // 경로에 한글이 들어 있어 서버가 인코딩해 보내는 경우가 있다.
  let fileName = lastSegment;
  try {
    fileName = decodeURIComponent(lastSegment);
  } catch {
    // 인코딩이 깨져 있으면 원문으로 계속한다. 숫자만 필요하다.
  }

  // 확장자를 떼고, 구분자로 시작하는 8자리 숫자 중 마지막 것을 본다.
  const withoutExtension = fileName.replace(/\.[A-Za-z0-9]{1,8}$/, '');
  const matches = [...withoutExtension.matchAll(/[_\-.](\d{8})(?=$)/g)];
  const raw = matches.at(-1)?.[1];
  if (!raw) return null;

  const year = Number(raw.slice(0, 4));
  const month = Number(raw.slice(4, 6));
  const day = Number(raw.slice(6, 8));
  if (year < 1900 || year > 2999 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  // 2월 30일처럼 달에 없는 날은 버린다(Date가 다음 달로 넘겨 버리는 것을 잡는다).
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return null;

  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
};

/** `2026-05-26T00:00:00.000Z` / `2026-05-26` → `2026-05-26`. 못 읽으면 null. */
const toDateKey = (value: string | null): string | null => {
  if (!value) return null;
  const head = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(head) ? head : null;
};

const labelForSubmission = (
  submission: PatentSearchSubmission,
  index: number,
  sameKindCount: number,
): string => {
  const base = submission.kind === 'OPINION' ? '의견서' : '보정서';
  return base;
  // return sameKindCount > 1 ? `${base} ${index + 1}` : base;
};

/**
 * 통지 건 하나의 문서들을 펼친다.
 *
 * 날짜 출처가 문서 종류마다 다르다.
 *   통지서 — `admin.action_date`(DB 값)를 먼저 쓰고, 없으면 파일명에서 읽는다.
 *            DB에 기록된 통지일이 파일명보다 정본이다.
 *   의견서·보정서 — 파일명뿐이다.
 *
 * 반환 순서는 절차 순서(통지서 → 의견서 → 보정서 → 기타)다. 시간축 정렬은
 * buildTimelineEntries가 날짜로 다시 한다.
 */
export const buildDocumentNodes = (item: PatentSearchItem): PatentDocumentNode[] => {
  const opinions = item.submissions.filter((s) => s.kind === 'OPINION');
  const amendments = item.submissions.filter((s) => s.kind === 'AMENDMENT');
  // kind를 해석하지 못한 코드도 버리지 않고 '기타 문서'로 남긴다.
  const others = item.submissions.filter((s) => s.kind === null);

  const nodes: PatentDocumentNode[] = [];

  const dateFor = (documentPath: string | null): Pick<PatentDocumentNode, 'date' | 'dateSource'> => {
    const fromFile = parseDateFromDocumentPath(documentPath);
    return fromFile ? { date: fromFile, dateSource: 'fileName' } : { date: null, dateSource: null };
  };

  if (item.content || item.documentPath || item.contentLength > 0) {
    const actionDate = toDateKey(item.actionDate);
    nodes.push({
      key: 'office-action',
      label: item.action ?? '의견제출통지서',
      kind: 'OFFICE_ACTION',
      sources: item.documentPath
        ? [{ label: item.action ?? '의견제출통지서', path: item.documentPath }]
        : [],
      content: item.content,
      ...(actionDate
        ? { date: actionDate, dateSource: 'actionDate' as const }
        : dateFor(item.documentPath)),
    });
  }

  [...opinions, ...amendments].forEach((submission) => {
    const sameKind = submission.kind === 'OPINION' ? opinions : amendments;
    const index = sameKind.indexOf(submission);
    const label = labelForSubmission(submission, index, sameKind.length);
    nodes.push({
      key: `submission-${submission.id ?? `${submission.kind}-${index}`}`,
      label,
      kind: submission.kind === 'OPINION' ? 'OPINION' : 'AMENDMENT',
      sources: submission.documentPath
        ? [{ label, path: submission.documentPath }]
        : [],
      content: submission.content,
      ...dateFor(submission.documentPath),
    });
  });

  others.forEach((submission, index) => {
    const label = `기타 문서${others.length > 1 ? ` ${index + 1}` : ''}`;
    nodes.push({
      key: `submission-other-${submission.id ?? index}`,
      label,
      kind: 'OTHER',
      sources: submission.documentPath
        ? [{ label, path: submission.documentPath }]
        : [],
      content: submission.content,
      ...dateFor(submission.documentPath),
    });
  });

  return nodes;
};

/**
 * 특허의 모든 문서를 날짜 오름차순 한 줄로 펼친다. 타임라인은 왼쪽이 과거다.
 *
 * 통지 건 단위가 아니라 문서 단위로 놓는다 — 파일명에서 문서마다 날짜를 읽을 수 있으므로,
 * 통지서와 그 대응 서류가 실제로 몇 달 떨어져 있으면 축에서도 떨어져야 한다.
 *
 * 날짜가 없는 문서는 맨 뒤로 보낸다(축 위에 끼워 넣을 근거가 없다). 날짜가 같으면
 * 절차 순서(통지서 → 대응)를 지킨다 — 같은 날 통지서와 의견서가 있다면 통지가 먼저다.
 */
export const buildTimelineEntries = (items: PatentSearchItem[]): PatentDocumentEntry[] => {
  const entries = items.flatMap((item) => (
    buildDocumentNodes(item).map((node, order) => ({ item, node, order }))
  ));

  return entries
    .sort((left, right) => {
      if (left.node.date && right.node.date && left.node.date !== right.node.date) {
        return left.node.date.localeCompare(right.node.date);
      }
      if (!left.node.date && right.node.date) return 1;
      if (left.node.date && !right.node.date) return -1;
      // 같은 날짜(또는 둘 다 날짜 없음)면 통지 건 순서 → 그 안의 절차 순서.
      const byItem = items.indexOf(left.item) - items.indexOf(right.item);
      return byItem !== 0 ? byItem : left.order - right.order;
    })
    .map(({ item, node }) => ({ item, node }));
};

/**
 * 같은 날짜가 이어지는 구간마다, 그 구간의 첫 index를 담은 배열.
 *
 * 타임라인은 날짜 라벨을 구간의 첫 문서 자리에만 그린다(같은 값이 반복되면 축이 시끄럽다).
 * 그래서 "고른 문서가 어느 구간에 속하는가"를 알아야 라벨을 활성으로 칠할 수 있다 —
 * 고른 문서 자리에 그대로 칠하면, 두 번째 이후 문서를 골랐을 때 그 자리 라벨은 숨겨져
 * 있어서 화면에 아무 변화가 없다.
 *
 * 날짜가 없는 문서(null)끼리도 한 구간으로 묶인다. 축 끝의 '날짜 없음'이 한 번만 나온다.
 */
export const dateGroupLeaders = (entries: PatentDocumentEntry[]): number[] => {
  const leaders: number[] = [];
  entries.forEach((entry, index) => {
    const sameAsPrevious = index > 0 && entries[index - 1].node.date === entry.node.date;
    leaders[index] = sameAsPrevious ? leaders[index - 1] : index;
  });
  return leaders;
};
