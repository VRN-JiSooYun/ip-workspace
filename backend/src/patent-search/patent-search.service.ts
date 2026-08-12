import { Injectable } from "@nestjs/common";
import {
  PatentSearchDateField,
  PatentSearchDto,
  PatentSearchFiltersDto,
  PatentSearchKeywordDto,
  PatentSearchKeywordTarget,
} from "./dto/patent-search.dto";
import { PatentSearchClient } from "./patent-search.client";
import {
  UpstreamDateField,
  UpstreamKeywordTarget,
  UpstreamSearchFilters,
  UpstreamSearchRequest,
  UpstreamSearchResponse,
  UpstreamSearchRow,
} from "./patent-search.types";

const DATE_FIELD_TO_UPSTREAM: Record<PatentSearchDateField, UpstreamDateField> =
  {
    applicationDate: "application_date",
    publicationDate: "publication_date",
    intApplicationDate: "int_application_date",
    intPublicationDate: "int_publication_date",
    examDate: "exam_date",
  };

const KEYWORD_TARGET_TO_UPSTREAM: Record<
  PatentSearchKeywordTarget,
  UpstreamKeywordTarget
> = {
  officeAction: "office_action",
  opinion: "opinion",
  amendment: "amendment",
};

/** `response.type` 코드. 외부 DB 값이라 여기서 이름만 붙인다. */
const RESPONSE_TYPE_BY_CODE: Record<number, PatentSearchResponseKind> = {
  1: "OPINION",
  2: "AMENDMENT",
};

/**
 * 외부 `legal_status` 코드 테이블(id → status). 목록 endpoint가 없어
 * `GET /legal_statuses/?status=...`로 6개를 하나씩 확인해 옮겼다.
 * 여기 없는 id가 오면 `legalStatus`는 null이 되고 `legalStatusId`는 그대로 남는다.
 */
const LEGAL_STATUS_BY_ID: Record<number, string> = {
  1: "공개",
  2: "취하",
  3: "거절",
  4: "등록",
  5: "포기",
  6: "소멸 (등록료불납)",
};

export type PatentSearchResponseKind = "OPINION" | "AMENDMENT";

export type PatentSearchExaminer = {
  id: number | null;
  office: string | null;
  bureau: string | null;
  department: string | null;
  name: string | null;
};

export type PatentSearchSubmission = {
  id: number | null;
  /** 1=의견서, 2=보정서. 미정의 코드는 kind가 null이 된다. */
  typeCode: number | null;
  kind: PatentSearchResponseKind | null;
  content: string | null;
  contentLength: number;
  documentPath: string | null;
};

export type PatentSearchRejection = {
  rejectionId: number | null;
  claim: string | null;
  lawType: number | null;
  article: number | null;
  paragraph: number | null;
  subParagraph: number | null;
};

/** 검색 응답에 없어 `GET /patents/`로 따로 채우는 부분. */
export type PatentSearchPatentDetail = {
  applicationDate: string | null;
  registrationNumber: string | null;
  registrationDate: string | null;
  publicationNumber: string | null;
  publicationDate: string | null;
  intApplicationNumber: string | null;
  intApplicationDate: string | null;
  intPublicationNumber: string | null;
  intPublicationDate: string | null;
  parentApplicationNumber: string | null;
  examDate: string | null;
  countryId: number | null;
  attorneyNumber: number | null;
};

export type PatentSearchItem = {
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
  /** `legalStatusId`를 외부 코드 테이블 값으로 옮긴 것. 모르는 코드면 null. */
  legalStatus: string | null;
  examStatusId: number | null;
  exam: boolean | null;
  examiners: PatentSearchExaminer[];
  submissions: PatentSearchSubmission[];
  rejections: PatentSearchRejection[];
  /** `includePatentDetail: true`일 때만 채워진다. 조회에 실패하면 null. */
  patent: PatentSearchPatentDetail | null;
};

export type PatentSearchResult = {
  total: number;
  page: number;
  size: number;
  items: PatentSearchItem[];
};

/**
 * 외부 특허 검색 API 중계.
 *
 * 로컬 `patent` table(PatentRecordModule)에는 OA·의견서·보정서 본문이 없다. 전문 검색
 * 대상 문서는 외부 서비스에만 있으므로 이 검색은 Prisma가 아니라 외부 API를 호출한다.
 */
@Injectable()
export class PatentSearchService {
  constructor(private readonly client: PatentSearchClient) {}

  async search(dto: PatentSearchDto): Promise<PatentSearchResult> {
    const body: UpstreamSearchRequest = {
      page: dto.page,
      size: dto.size,
    };

    const filters = dto.filters
      ? this.toUpstreamFilters(dto.filters)
      : undefined;
    // 빈 객체를 보내면 외부 Pydantic 모델이 전체 조회로 처리하긴 하지만,
    // 조건이 없다는 뜻을 명확히 하려고 key 자체를 뺀다.
    if (filters && Object.keys(filters).length > 0) body.filters = filters;

    if (dto.keywords?.length) {
      body.keywords = dto.keywords.map((keyword) =>
        this.toUpstreamKeyword(keyword),
      );
    }

    const response = await this.client.search(body);
    const result = this.toResult(response, dto);

    if (dto.includePatentDetail) {
      await this.attachPatentDetails(result.items);
    }
    return result;
  }

  /**
   * 결과의 출원번호마다 `patent` 상세를 붙인다.
   *
   * 같은 특허에 OA가 여러 건이면 같은 출원번호가 여러 행으로 나오므로 중복을 먼저 없애고
   * 병렬로 조회한다. 개별 조회 실패는 null로 접혀 검색 결과 전체를 버리지 않는다.
   */
  private async attachPatentDetails(items: PatentSearchItem[]): Promise<void> {
    const applicationNumbers = [
      ...new Set(
        items
          .map((item) => item.applicationNumber)
          .filter((value): value is string => Boolean(value)),
      ),
    ];
    if (applicationNumbers.length === 0) return;

    const details = await Promise.all(
      applicationNumbers.map(async (applicationNumber) => {
        const detail =
          await this.client.findPatentByApplicationNumber(applicationNumber);
        return [applicationNumber, detail] as const;
      }),
    );
    const byApplicationNumber = new Map(details);

    for (const item of items) {
      const detail = item.applicationNumber
        ? byApplicationNumber.get(item.applicationNumber)
        : null;
      item.patent = detail
        ? {
            applicationDate: detail.application_date ?? null,
            registrationNumber: detail.registration_number ?? null,
            registrationDate: detail.registration_date ?? null,
            publicationNumber: detail.publication_number ?? null,
            publicationDate: detail.publication_date ?? null,
            intApplicationNumber: detail.int_application_number ?? null,
            intApplicationDate: detail.int_application_date ?? null,
            intPublicationNumber: detail.int_publication_number ?? null,
            intPublicationDate: detail.int_publication_date ?? null,
            parentApplicationNumber: detail.parent_application_number ?? null,
            examDate: detail.exam_date ?? null,
            countryId: detail.country ?? null,
            attorneyNumber: detail.attorney_number ?? null,
          }
        : null;
    }
  }

  private toUpstreamFilters(
    filters: PatentSearchFiltersDto,
  ): UpstreamSearchFilters {
    const payload: UpstreamSearchFilters = {};

    if (filters.legalStatusText?.length) {
      payload.legal_status_text = filters.legalStatusText;
    }
    if (filters.examStatusText?.length) {
      payload.exam_status_text = filters.examStatusText;
    }
    if (filters.examRequested !== undefined) {
      payload.exam_requested = filters.examRequested;
    }
    if (filters.attorneyNames?.length) {
      payload.attorney_names = filters.attorneyNames;
    }
    if (filters.examinerNames?.length) {
      payload.examiner_names = filters.examinerNames;
    }
    if (filters.hasOpinion !== undefined) {
      payload.has_opinion = filters.hasOpinion;
    }
    if (filters.hasAmendment !== undefined) {
      payload.has_amendment = filters.hasAmendment;
    }

    const ipc = (filters.ipc ?? [])
      .map((item) => ({
        ...(item.section !== undefined ? { section: item.section } : {}),
        ...(item.classCode !== undefined ? { class_code: item.classCode } : {}),
        ...(item.subclass !== undefined ? { subclass: item.subclass } : {}),
        ...(item.mainGroup !== undefined ? { main_group: item.mainGroup } : {}),
        ...(item.subgroup !== undefined ? { subgroup: item.subgroup } : {}),
      }))
      // 전부 비어 있는 항목은 조건이 아니라 잡음이라 버린다.
      .filter((item) => Object.keys(item).length > 0);
    if (ipc.length) payload.ipc = ipc;

    const statutes = (filters.statutes ?? [])
      .map((item) => ({
        // 외부 API는 law_type을 int | str로 받는다. 명칭이 있으면 그쪽을 쓴다.
        ...(item.lawTypeText !== undefined
          ? { law_type: item.lawTypeText }
          : item.lawType !== undefined
            ? { law_type: item.lawType }
            : {}),
        ...(item.article !== undefined ? { article: item.article } : {}),
        ...(item.paragraph !== undefined ? { paragraph: item.paragraph } : {}),
        ...(item.subParagraph !== undefined
          ? { sub_paragraph: item.subParagraph }
          : {}),
      }))
      .filter((item) => Object.keys(item).length > 0);
    if (statutes.length) payload.statutes = statutes;

    const dateRanges = (filters.dateRanges ?? [])
      .map((item) => ({
        field: DATE_FIELD_TO_UPSTREAM[item.field],
        ...(item.from !== undefined ? { from: item.from } : {}),
        ...(item.to !== undefined ? { to: item.to } : {}),
      }))
      // from/to 둘 다 없으면 범위가 아니므로 보내지 않는다.
      .filter((item) => item.from !== undefined || item.to !== undefined);
    if (dateRanges.length) payload.date_ranges = dateRanges;

    return payload;
  }

  /** target은 항상 1개다(DTO 주석 참고). 그래서 배열로 감싸기만 한다. */
  private toUpstreamKeyword(keyword: PatentSearchKeywordDto) {
    return {
      query: keyword.query,
      targets: [KEYWORD_TARGET_TO_UPSTREAM[keyword.target]],
      operator: keyword.operator,
    };
  }

  private toResult(
    response: UpstreamSearchResponse,
    dto: PatentSearchDto,
  ): PatentSearchResult {
    return {
      total: Number(response.total ?? 0),
      // 외부 응답의 page/size를 그대로 쓰지 않고 요청값을 돌려준다.
      // 범위를 넘긴 page도 그대로 반사되므로 요청과 일치시키는 편이 예측 가능하다.
      page: dto.page,
      size: dto.size,
      items: (response.data ?? []).map((row) =>
        this.toItem(row, dto.includeContent),
      ),
    };
  }

  private toItem(
    row: UpstreamSearchRow,
    includeContent: boolean,
  ): PatentSearchItem {
    return {
      officeActionId: row.office_action_id ?? null,
      // admin_id와 admin_id_ref는 같은 값이라 하나만 내보낸다.
      adminId: row.admin_id ?? row.admin_id_ref ?? null,
      content: includeContent ? (row.office_action_content ?? null) : null,
      contentLength: row.office_action_content?.length ?? 0,
      documentPath: row.office_action_document_path ?? null,
      actionDate: row.action_date ?? null,
      action: row.action ?? null,
      actionNumber: row.action_number ?? null,
      patentId: row.patent_id ?? null,
      applicationNumber: row.application_number ?? null,
      koreanTitle: row.korean_title ?? null,
      englishTitle: row.english_title ?? null,
      applicant: row.applicant ?? null,
      legalStatusId: row.legal_status ?? null,
      legalStatus:
        row.legal_status !== null && row.legal_status !== undefined
          ? (LEGAL_STATUS_BY_ID[row.legal_status] ?? null)
          : null,
      examStatusId: row.exam_status ?? null,
      exam: row.exam ?? null,
      examiners: (row.examiners ?? []).map((examiner) => ({
        id: examiner.id ?? null,
        office: examiner.office ?? null,
        bureau: examiner.bureau ?? null,
        department: examiner.department ?? null,
        name: examiner.name ?? null,
      })),
      submissions: (row.responses ?? []).map((submission) => ({
        id: submission.id ?? null,
        typeCode: submission.type ?? null,
        kind:
          submission.type !== null && submission.type !== undefined
            ? (RESPONSE_TYPE_BY_CODE[submission.type] ?? null)
            : null,
        content: includeContent ? (submission.content ?? null) : null,
        contentLength: submission.content?.length ?? 0,
        documentPath: submission.document_path ?? null,
      })),
      rejections: (row.legal_statutes ?? []).map((rejection) => ({
        rejectionId: rejection.rejection_id ?? null,
        claim: rejection.claim ?? null,
        lawType: rejection.law_type ?? null,
        article: rejection.article ?? null,
        paragraph: rejection.paragraph ?? null,
        subParagraph: rejection.sub_paragraph ?? null,
      })),
      // includePatentDetail일 때 attachPatentDetails가 채운다.
      patent: null,
    };
  }
}
