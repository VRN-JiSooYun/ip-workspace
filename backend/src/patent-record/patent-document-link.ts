/**
 * 관리 특허에 OA DB의 문서를 이어 붙이는 규칙.
 *
 * ## 왜 검색 API가 아니라 OA DB인가
 *
 * 처음 생각한 길은 `POST /patents/search`를 출원번호로 부르는 것이었는데, 그 API에는
 * **출원번호 조건이 없다**(필터는 법적 상태·심사 상태·대리인·심사관·IPC·법조문·기간뿐이고,
 * 키워드는 OA 본문 전문 검색이다). `GET /admins/`도 action_number로만 거를 수 있어 특허에서
 * 문서로 내려갈 수 없다.
 *
 * 대신 이 서버에는 OA PostgreSQL 읽기 전용 연결이 이미 있다(OaDatabaseService). 조인 한
 * 번이면 `patent → admin → office_action → response`가 그대로 나온다 — 검색 API가 중계하는
 * 것과 같은 테이블이고, 오히려 원본에 가깝다.
 *
 * ## 출원번호는 숫자만 남겨 맞춘다
 *
 * OA DB의 출원번호는 구분자 없는 13자리다(`1020227002845`). 우리 쪽은 운영 시트 표기를
 * 그대로 보존해 `10-2022-0001748`처럼 들어 있다. 숫자만 남기면 같은 값이 된다.
 *
 * **KR 건만 이어 붙일 수 있다.** OA DB는 20,786건이 모두 country=1이고 13자리다. 미국
 * (`19/585,479` → 8자리)·EP·PCT는 숫자만 남겨도 자리수가 맞지 않아 애초에 찾을 것이 없다.
 * 그래서 조회를 보내기 전에 형식으로 먼저 거른다 — 없는 것을 못 찾은 것과, 애초에 찾을 수
 * 없는 것은 화면에서 다르게 말해야 한다.
 *
 * Prisma를 import하지 않는 순수 모듈로 둔다(patent-record-documents.ts와 같은 이유).
 */

/** OA DB의 출원번호 자릿수. 전부 KR 13자리다. */
const OA_APPLICATION_NUMBER_LENGTH = 13;

/** 구분자를 걷어낸 출원번호. 빈 문자열이면 숫자가 하나도 없었다는 뜻이다. */
export const normalizeApplicationNumber = (value: string): string =>
  value.replace(/[^0-9]/g, "");

export type LinkableCheck =
  | { linkable: true; normalized: string }
  /** OA DB에서 찾을 수 있는 모양이 아니다. 조회를 보낼 필요도 없다. */
  | { linkable: false; reason: "NOT_KR_APPLICATION_NUMBER"; normalized: string };

export const checkLinkable = (applicationNumber: string): LinkableCheck => {
  const normalized = normalizeApplicationNumber(applicationNumber);
  if (normalized.length !== OA_APPLICATION_NUMBER_LENGTH) {
    // 정규화 값도 함께 돌려준다 — 화면이 "13자리가 아니라 8자리였다"를 짚어 줄 수 있어야 한다.
    return { linkable: false, reason: "NOT_KR_APPLICATION_NUMBER", normalized };
  }
  return { linkable: true, normalized };
};

/** OA DB 조인이 돌려주는 평평한 행. 한 줄이 `admin × office_action × response` 하나다. */
export type OaDocumentRow = {
  admin_id: number;
  action: string | null;
  action_date: Date | null;
  action_number: string | null;
  oa_id: number;
  oa_content: string | null;
  oa_document_path: string | null;
  response_id: number | null;
  response_type: number | null;
  response_content: string | null;
  response_document_path: string | null;
};

export type LinkedResponse = {
  type: number | null;
  content: string | null;
  documentPath: string | null;
};

export type LinkedOfficeAction = {
  content: string | null;
  documentPath: string | null;
  responses: LinkedResponse[];
};

export type LinkedAdmin = {
  action: string | null;
  actionDate: Date | null;
  actionNumber: string | null;
  officeActions: LinkedOfficeAction[];
};

/**
 * 평평한 조인 결과를 admin → office_action → response 계층으로 되돌린다.
 *
 * **문서가 없는 가지는 버린다.** 통지서에 PDF가 없고 그 아래 제출 서류에도 없으면 이어
 * 붙일 것이 없다 — 본문만 복사해 두면 문서 건수만 늘어나고 뷰어에서는 열리지 않는다.
 * 반대로 통지서에 PDF가 없어도 의견서에 있으면 통지서째 가져온다(제출 서류는 통지서에
 * 매달려야 자리를 잡는다).
 */
export const groupOaDocumentRows = (rows: OaDocumentRow[]): LinkedAdmin[] => {
  const admins = new Map<number, LinkedAdmin>();
  const officeActions = new Map<number, LinkedOfficeAction>();
  /** 같은 응답이 조인으로 여러 번 나오지는 않지만, 방어적으로 한 번만 담는다. */
  const seenResponses = new Set<number>();

  for (const row of rows) {
    let admin = admins.get(row.admin_id);
    if (!admin) {
      admin = {
        action: row.action,
        actionDate: row.action_date,
        actionNumber: row.action_number,
        officeActions: [],
      };
      admins.set(row.admin_id, admin);
    }

    let officeAction = officeActions.get(row.oa_id);
    if (!officeAction) {
      officeAction = {
        content: row.oa_content,
        documentPath: row.oa_document_path,
        responses: [],
      };
      officeActions.set(row.oa_id, officeAction);
      admin.officeActions.push(officeAction);
    }

    if (row.response_id !== null && !seenResponses.has(row.response_id)) {
      seenResponses.add(row.response_id);
      officeAction.responses.push({
        type: row.response_type,
        content: row.response_content,
        documentPath: row.response_document_path,
      });
    }
  }

  return [...admins.values()]
    .map((admin) => ({
      ...admin,
      officeActions: admin.officeActions
        .map((officeAction) => ({
          ...officeAction,
          // 문서 없는 제출 서류는 붙여 봐야 뷰어에서 열 것이 없다.
          responses: officeAction.responses.filter((response) => response.documentPath),
        }))
        .filter(
          (officeAction) =>
            officeAction.documentPath || officeAction.responses.length > 0,
        ),
    }))
    .filter((admin) => admin.officeActions.length > 0);
};

/** 한 번의 연결이 무엇을 했는지. 화면이 이대로 사람 말로 옮긴다. */
export type LinkDocumentsResult = {
  /** OA DB에서 이 특허를 찾았는가. */
  matched: boolean;
  /** 찾을 수 없는 모양이면 그 이유. 찾아봤지만 없던 것과 구분한다. */
  reason?: "NOT_KR_APPLICATION_NUMBER" | "NOT_FOUND_UPSTREAM" | "NO_DOCUMENTS";
  /** 숫자만 남긴 출원번호. 왜 못 찾았는지 사람이 짚어 볼 수 있게 함께 돌려준다. */
  normalizedApplicationNumber: string;
  /** 이번에 새로 만든 행 수. 다시 눌러도 같은 문서면 0이 된다. */
  created: { admins: number; officeActions: number; responses: number };
  /** 이미 있어서 건너뛴 문서 수(통지서 기준). */
  skipped: number;
  /** 특허 단위 문서(명세서·공보)를 새로 채웠는가. */
  patentDocumentLinked: boolean;
  /** 연결 후의 문서 건수. 목록 배지와 같은 기준이다. */
  documentCount: number;
};
