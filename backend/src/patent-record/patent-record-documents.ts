/**
 * 관리 특허의 문서를, 의견제출통지서 화면이 쓰는 문서 뷰어와 같은 모양으로 옮기는 규칙.
 *
 * 두 화면이 같은 뷰어(PatentDocumentViewer)를 쓰기 때문에 응답도 같은 shape이어야 한다.
 * 다만 출처가 다르다 — 그쪽은 외부 검색 API가 주는 것을 중계하고, 이쪽은 로컬
 * `patent → admin → office_action → response`를 조립한다.
 *
 * Prisma를 import하지 않는 순수 모듈로 둔다. 조회는 서비스가 하고 여기서는 모양만 바꾼다.
 * (서비스를 직접 import하면 generated Prisma client까지 딸려 와 jest가 파싱하지 못한다.)
 */

export type PatentDocumentResponseKind = "OPINION" | "AMENDMENT";

/**
 * `response.type` 코드. 외부 DB와 같은 값 체계를 쓴다
 * (patent-search.service.ts의 RESPONSE_TYPE_BY_CODE와 같아야 한다).
 */
const RESPONSE_KIND_BY_CODE: Record<number, PatentDocumentResponseKind> = {
  1: "OPINION",
  2: "AMENDMENT",
};

/** 조회 결과에서 이 모듈이 실제로 쓰는 부분만. */
export type AdminWithDocuments = {
  id: number;
  action: string | null;
  actionDate: Date | null;
  actionNumber: string | null;
  officeActions: Array<{
    id: number;
    content: string | null;
    documentPath: string | null;
    responses: Array<{
      id: number;
      type: number | null;
      content: string | null;
      documentPath: string | null;
    }>;
    oaExaminers: Array<{
      examiner: {
        id: number;
        office: string | null;
        bureau: string | null;
        department: string | null;
        name: string;
      };
    }>;
    rejections: Array<{
      id: number;
      claim: string | null;
      statute: {
        lawType: number | null;
        article: number | null;
        paragraph: number | null;
        subParagraph: number | null;
      } | null;
    }>;
  }>;
};

export type PatentForDocuments = {
  id: number;
  applicationNumber: string;
  /** 특허 단위 문서(명세서·공보). OA에 매달리지 않는다. */
  documentPath: string | null;
  koreanTitle: string | null;
  englishTitle: string | null;
  applicant: string | null;
  legalStatusId: number | null;
  legalStatus: { status: string } | null;
  examStatusId: number | null;
  examStatus: { status: string } | null;
  exam: boolean | null;
};

/** 의견제출통지서 화면의 `PatentSearchItem`과 같은 모양. 뷰어가 이대로 받는다. */
export type PatentDocumentItem = {
  officeActionId: number | null;
  adminId: number | null;
  content: string | null;
  contentLength: number;
  documentPath: string | null;
  actionDate: string | null;
  action: string | null;
  actionNumber: string | null;
  patentId: number | null;
  applicationNumber: string | null;
  koreanTitle: string | null;
  englishTitle: string | null;
  applicant: string | null;
  legalStatusId: number | null;
  legalStatus: string | null;
  examStatusId: number | null;
  exam: boolean | null;
  examiners: Array<{
    id: number | null;
    office: string | null;
    bureau: string | null;
    department: string | null;
    name: string | null;
  }>;
  submissions: Array<{
    id: number | null;
    typeCode: number | null;
    kind: PatentDocumentResponseKind | null;
    content: string | null;
    contentLength: number;
    documentPath: string | null;
  }>;
  rejections: Array<{
    rejectionId: number | null;
    claim: string | null;
    lawType: number | null;
    article: number | null;
    paragraph: number | null;
    subParagraph: number | null;
  }>;
  patent: null;
};

/**
 * admin 아래의 office_action 하나를 뷰어가 받는 항목 하나로 옮긴다.
 * 의견서·보정서는 항목 안의 `submissions`로 들어가므로 목록이 그만큼 늘지 않는다.
 */
/**
 * 특허 단위 문서 한 항목.
 *
 * 통지서가 없는 문서라 admin·office_action이 비어 있다. 뷰어는 항목 하나에 `documentPath`가
 * 있으면 그것을 열므로, 처분명 자리에 무엇인지만 적어 주면 그대로 그려진다.
 */
const toPatentDocumentItem = (
  patent: PatentForDocuments,
  toPublicUrl: DocumentUrlRewriter,
): PatentDocumentItem => ({
  officeActionId: null,
  adminId: null,
  content: null,
  contentLength: 0,
  documentPath: toPublicUrl(patent.documentPath),
  actionDate: null,
  action: "특허 문서",
  actionNumber: null,
  patentId: patent.id,
  applicationNumber: patent.applicationNumber,
  koreanTitle: patent.koreanTitle,
  englishTitle: patent.englishTitle,
  applicant: patent.applicant,
  legalStatusId: patent.legalStatusId,
  legalStatus: patent.legalStatus?.status ?? null,
  examStatusId: patent.examStatusId,
  exam: patent.exam,
  examiners: [],
  submissions: [],
  rejections: [],
  patent: null,
});

/**
 * 문서 URL을 밖에서 닿는 주소로 옮기는 함수. 넘기지 않으면 상류 주소를 그대로 쓴다.
 * (검색 화면과 같은 규칙이다 — common/document-url 하나를 둘이 쓴다.)
 */
export type DocumentUrlRewriter = (value: string | null | undefined) => string | null;

const passThrough: DocumentUrlRewriter = (value) => value ?? null;

export const toPatentDocumentItems = (
  patent: PatentForDocuments,
  admins: AdminWithDocuments[],
  toPublicUrl: DocumentUrlRewriter = passThrough,
): PatentDocumentItem[] => [
  // 특허 문서를 맨 앞에 둔다. 처분 이력보다 앞선 문서이고 날짜가 없어 정렬에 끼지 못한다.
  ...(patent.documentPath ? [toPatentDocumentItem(patent, toPublicUrl)] : []),
  ...toOfficeActionItems(patent, admins, toPublicUrl),
];

const toOfficeActionItems = (
  patent: PatentForDocuments,
  admins: AdminWithDocuments[],
  toPublicUrl: DocumentUrlRewriter,
): PatentDocumentItem[] =>
  admins.flatMap((admin) =>
    admin.officeActions.map((officeAction) => ({
      officeActionId: officeAction.id,
      adminId: admin.id,
      content: officeAction.content,
      contentLength: officeAction.content?.length ?? 0,
      documentPath: toPublicUrl(officeAction.documentPath),
      // 뷰어는 문자열 날짜를 받아 formatDisplayDateOnly로 찍는다.
      actionDate: admin.actionDate ? admin.actionDate.toISOString() : null,
      action: admin.action,
      actionNumber: admin.actionNumber,
      patentId: patent.id,
      applicationNumber: patent.applicationNumber,
      koreanTitle: patent.koreanTitle,
      englishTitle: patent.englishTitle,
      applicant: patent.applicant,
      legalStatusId: patent.legalStatusId,
      legalStatus: patent.legalStatus?.status ?? null,
      examStatusId: patent.examStatusId,
      exam: patent.exam,
      examiners: officeAction.oaExaminers.map(({ examiner }) => ({
        id: examiner.id,
        office: examiner.office,
        bureau: examiner.bureau,
        department: examiner.department,
        name: examiner.name,
      })),
      submissions: officeAction.responses.map((response) => ({
        id: response.id,
        typeCode: response.type,
        // 모르는 코드는 버리지 않고 kind만 null로 둔다(뷰어가 '기타 문서'로 그린다).
        kind: response.type === null ? null : (RESPONSE_KIND_BY_CODE[response.type] ?? null),
        content: response.content,
        contentLength: response.content?.length ?? 0,
        documentPath: toPublicUrl(response.documentPath),
      })),
      rejections: officeAction.rejections.map((rejection) => ({
        rejectionId: rejection.id,
        claim: rejection.claim,
        lawType: rejection.statute?.lawType ?? null,
        article: rejection.statute?.article ?? null,
        paragraph: rejection.statute?.paragraph ?? null,
        subParagraph: rejection.statute?.subParagraph ?? null,
      })),
      // 로컬 조회는 patent 본체를 이미 위 필드로 펼쳐 담았다.
      patent: null,
    })),
  );

/**
 * 목록 배지에 쓸 특허별 문서 건수.
 *
 * 뷰어가 항목 하나에 통지서와 그 제출 서류를 함께 담으므로, 배지도 통지서 수로 센다
 * (= toPatentDocumentItems가 만드는 항목 수).
 */
export const countDocumentsByPatent = (
  admins: Array<{ patentId: number; _count: { officeActions: number } }>,
  /** 특허 단위 문서를 가진 특허. 통지서가 없어도 뷰어에 한 항목으로 나오므로 함께 센다. */
  patentsWithDocument: Iterable<number> = [],
): Map<number, number> => {
  const counts = new Map<number, number>();
  for (const admin of admins) {
    counts.set(
      admin.patentId,
      (counts.get(admin.patentId) ?? 0) + admin._count.officeActions,
    );
  }
  for (const patentId of patentsWithDocument) {
    counts.set(patentId, (counts.get(patentId) ?? 0) + 1);
  }
  return counts;
};
