import { Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createDocumentUrlRewriter } from "../common/document-url";
import { OaDatabaseService } from "../oa-database/oa-database.service";
import type {
  PatentSearchExaminer,
  PatentSearchItem,
  PatentSearchPatentDetail,
  PatentSearchRejection,
  PatentSearchSubmission,
} from "./patent-search.service";

export type PatentSearchIndexIpc = {
  section: string | null;
  classCode: string | null;
  subclass: string | null;
  mainGroup: string | null;
  subgroup: string | null;
};

export type PatentSearchIndexItem = PatentSearchItem & {
  filterIndex: {
    attorneyName: string | null;
    examStatus: string | null;
    ipcs: PatentSearchIndexIpc[];
  };
};

type IndexRow = {
  cursor_id: number;
  office_action_id: number;
  content_length: number | string;
  document_path: string | null;
  admin_id: number;
  action_date: Date | string | null;
  action: string | null;
  action_number: string | null;
  patent_id: number;
  application_number: string | null;
  korean_title: string | null;
  english_title: string | null;
  applicant: string | null;
  legal_status_id: number | null;
  legal_status: string | null;
  exam_status_id: number | null;
  exam_status: string | null;
  exam: boolean | null;
  application_date: Date | string | null;
  registration_number: string | null;
  registration_date: Date | string | null;
  publication_number: string | null;
  publication_date: Date | string | null;
  int_application_number: string | null;
  int_application_date: Date | string | null;
  int_publication_number: string | null;
  int_publication_date: Date | string | null;
  parent_application_number: string | null;
  exam_date: Date | string | null;
  country_id: number | null;
  attorney_number: number | null;
  attorney_name: string | null;
  examiners?: PatentSearchExaminer[] | null;
  submissions?: Array<{
    id: number | null;
    typeCode: number | null;
    contentLength: number | string;
    documentPath: string | null;
  }> | null;
  rejections?: PatentSearchRejection[] | null;
  ipcs?: PatentSearchIndexIpc[] | null;
};

type ResponseIndexRow = {
  cursor_id: number;
  oa_id: number;
  id: number;
  type_code: number | null;
  document_path: string | null;
};

type ExaminerIndexRow = PatentSearchExaminer & {
  cursor_id: number;
  oa_id: number;
};

type RejectionIndexRow = {
  cursor_id: number;
  oa_id: number;
  rejectionId: number;
  claim: string | null;
  lawType: number | null;
  article: number | null;
  paragraph: number | null;
  subParagraph: number | null;
};

type IpcIndexRow = PatentSearchIndexIpc & {
  cursor_id: number;
  patent_id: number;
};

type DocumentContentRow = {
  content: string | null;
  submissions: Array<{
    id: number | null;
    typeCode: number | null;
    content: string | null;
    documentPath: string | null;
  }> | null;
};

const RESPONSE_KIND = { 1: "OPINION", 2: "AMENDMENT" } as const;

/** content 없이 전체 OA를 한 번에 내려 주는 프런트 필터 전용 인덱스. */
@Injectable()
export class PatentSearchIndexService {
  /** OA DB의 5초 query timeout 안에서 전송까지 끝낼 수 있도록 한 번에 읽는 최대 행 수. */
  private static readonly INDEX_BATCH_SIZE = 2000;
  private readonly toPublicDocumentUrl: (value: string | null | undefined) => string | null;

  constructor(
    private readonly database: OaDatabaseService,
    config: ConfigService,
  ) {
    this.toPublicDocumentUrl = createDocumentUrlRewriter(
      config.get<string | null>("documents.fileOrigin", null),
    );
  }

  async getIndex(): Promise<{ generatedAt: string; total: number; items: PatentSearchIndexItem[] }> {
    const rows = await this.readBaseRows();
    const submissions = await this.readSubmissions();
    const examiners = await this.readExaminers();
    const rejections = await this.readRejections();
    const ipcs = await this.readIpcs();

    const submissionsByOa = this.groupBy(submissions, (row) => row.oa_id);
    const examinersByOa = this.groupBy(examiners, (row) => row.oa_id);
    const rejectionsByOa = this.groupBy(rejections, (row) => row.oa_id);
    const ipcsByPatent = this.groupBy(ipcs, (row) => row.patent_id);

    const items = rows.map((row) => this.toItem({
      ...row,
      submissions: (submissionsByOa.get(row.office_action_id) ?? []).map((item) => ({
        id: item.id,
        typeCode: item.type_code,
        contentLength: 0,
        documentPath: item.document_path,
      })),
      examiners: (examinersByOa.get(row.office_action_id) ?? []).map((item) => ({
        id: item.id,
        office: item.office,
        bureau: item.bureau,
        department: item.department,
        name: item.name,
      })),
      rejections: (rejectionsByOa.get(row.office_action_id) ?? []).map((item) => ({
        rejectionId: item.rejectionId,
        claim: item.claim,
        lawType: item.lawType,
        article: item.article,
        paragraph: item.paragraph,
        subParagraph: item.subParagraph,
      })),
      ipcs: (ipcsByPatent.get(row.patent_id) ?? []).map((item) => ({
        section: item.section,
        classCode: item.classCode,
        subclass: item.subclass,
        mainGroup: item.mainGroup,
        subgroup: item.subgroup,
      })),
    }));
    items.sort((left, right) => {
      const dateOrder = (right.actionDate ?? "").localeCompare(left.actionDate ?? "");
      return dateOrder || (right.officeActionId ?? 0) - (left.officeActionId ?? 0);
    });
    return { generatedAt: new Date().toISOString(), total: items.length, items };
  }

  private async collectBatches<T extends { cursor_id: number }>(
    read: (cursor: number, size: number) => Promise<T[]>,
  ): Promise<T[]> {
    const result: T[] = [];
    let cursor = 0;
    while (true) {
      const batch = await read(cursor, PatentSearchIndexService.INDEX_BATCH_SIZE);
      result.push(...batch);
      if (batch.length < PatentSearchIndexService.INDEX_BATCH_SIZE) return result;
      cursor = batch[batch.length - 1].cursor_id;
    }
  }

  private groupBy<T, K>(items: T[], keyOf: (item: T) => K): Map<K, T[]> {
    const grouped = new Map<K, T[]>();
    for (const item of items) {
      const key = keyOf(item);
      const bucket = grouped.get(key);
      if (bucket) bucket.push(item);
      else grouped.set(key, [item]);
    }
    return grouped;
  }

  private readBaseRows(): Promise<IndexRow[]> {
    return this.collectBatches((cursor, size) => this.database.query<IndexRow>(
      `select oa.id as cursor_id,
              oa.id as office_action_id,
              0::int as content_length,
              oa.document_path,
              a.id as admin_id,
              a.action_date,
              a.action,
              a.action_number,
              p.id as patent_id,
              p.application_number,
              p.korean_title,
              p.english_title,
              p.applicant,
              p.legal_status as legal_status_id,
              legal.status as legal_status,
              p.exam_status as exam_status_id,
              exam_status.status as exam_status,
              p.exam,
              p.application_date,
              p.registration_number,
              p.registration_date,
              p.publication_number,
              p.publication_date,
              p.int_application_number,
              p.int_application_date,
              p.int_publication_number,
              p.int_publication_date,
              p.parent_application_number,
              p.exam_date,
              p.country as country_id,
              p.attorney_number,
              attorney.attorney_name
         from office_action oa
         join admin a on a.id = oa.admin_id
         join patent p on p.id = a.patent_id
         left join legal_status legal on legal.id = p.legal_status
         left join exam_status on exam_status.id = p.exam_status
         left join attorney on attorney.attorney_number = p.attorney_number
        where oa.id > $1
        order by oa.id
        limit $2`,
      [cursor, size],
    ));
  }

  private readSubmissions(): Promise<ResponseIndexRow[]> {
    return this.collectBatches((cursor, size) => this.database.query<ResponseIndexRow>(
      `select r.id as cursor_id, r.oa_id, r.id, r.type as type_code, r.document_path
         from response r
        where r.id > $1
        order by r.id
        limit $2`,
      [cursor, size],
    ));
  }

  private readExaminers(): Promise<ExaminerIndexRow[]> {
    return this.collectBatches((cursor, size) => this.database.query<ExaminerIndexRow>(
      `select oe.id as cursor_id, oe.oa_id, e.id, e.office, e.bureau, e.department, e.name
         from oa_examiner oe
         join examiner e on e.id = oe.examiner_id
        where oe.id > $1
        order by oe.id
        limit $2`,
      [cursor, size],
    ));
  }

  private readRejections(): Promise<RejectionIndexRow[]> {
    return this.collectBatches((cursor, size) => this.database.query<RejectionIndexRow>(
      `select r.id as cursor_id,
              r.oa_id,
              r.id as "rejectionId",
              r.claim,
              ls.law_type as "lawType",
              ls.article,
              ls.paragraph,
              ls.sub_paragraph as "subParagraph"
         from rejection r
         left join legal_statutes ls on ls.id = r.statute_id
        where r.id > $1
        order by r.id
        limit $2`,
      [cursor, size],
    ));
  }

  private readIpcs(): Promise<IpcIndexRow[]> {
    return this.collectBatches((cursor, size) => this.database.query<IpcIndexRow>(
      `select pi.id as cursor_id,
              pi.patent_id,
              i.section,
              i.class_code as "classCode",
              i.subclass,
              i.main_group as "mainGroup",
              i.subgroup
         from patent_ipc pi
         join ipc i on i.id = pi.ipc_id
        where pi.id > $1
        order by pi.id
        limit $2`,
      [cursor, size],
    ));
  }

  /** 인덱스에서 뺀 본문은 사용자가 결과 카드를 고른 한 건만 지연 조회한다. */
  async getDocumentContent(officeActionId: number): Promise<{
    content: string | null;
    contentLength: number;
    submissions: PatentSearchSubmission[];
  }> {
    const rows = await this.database.query<DocumentContentRow>(
      `select oa.content,
              coalesce(
                jsonb_agg(
                  jsonb_build_object(
                    'id', r.id,
                    'typeCode', r.type,
                    'content', r.content,
                    'documentPath', r.document_path
                  ) order by r.id
                ) filter (where r.id is not null),
                '[]'::jsonb
              ) as submissions
         from office_action oa
         left join response r on r.oa_id = oa.id
        where oa.id = $1
        group by oa.id`,
      [officeActionId],
    );
    const row = rows[0];
    if (!row) throw new NotFoundException("OFFICE_ACTION_NOT_FOUND");

    return {
      content: row.content,
      contentLength: row.content?.length ?? 0,
      submissions: (row.submissions ?? []).map((item) => ({
        id: item.id,
        typeCode: item.typeCode,
        kind: item.typeCode === 1 || item.typeCode === 2 ? RESPONSE_KIND[item.typeCode] : null,
        content: item.content,
        contentLength: item.content?.length ?? 0,
        documentPath: this.toPublicDocumentUrl(item.documentPath),
      })),
    };
  }

  private toDate(value: Date | string | null): string | null {
    if (!value) return null;
    return value instanceof Date ? value.toISOString() : value;
  }

  private toItem(row: IndexRow): PatentSearchIndexItem {
    const patent: PatentSearchPatentDetail = {
      applicationDate: this.toDate(row.application_date),
      registrationNumber: row.registration_number,
      registrationDate: this.toDate(row.registration_date),
      publicationNumber: row.publication_number,
      publicationDate: this.toDate(row.publication_date),
      intApplicationNumber: row.int_application_number,
      intApplicationDate: this.toDate(row.int_application_date),
      intPublicationNumber: row.int_publication_number,
      intPublicationDate: this.toDate(row.int_publication_date),
      parentApplicationNumber: row.parent_application_number,
      examDate: this.toDate(row.exam_date),
      countryId: row.country_id,
      attorneyNumber: row.attorney_number,
    };

    const submissions: PatentSearchSubmission[] = (row.submissions ?? []).map((item) => ({
      id: item.id,
      typeCode: item.typeCode,
      kind: item.typeCode === 1 || item.typeCode === 2 ? RESPONSE_KIND[item.typeCode] : null,
      content: null,
      contentLength: Number(item.contentLength ?? 0),
      documentPath: this.toPublicDocumentUrl(item.documentPath),
    }));

    return {
      officeActionId: row.office_action_id,
      relevanceScore: null,
      adminId: row.admin_id,
      content: null,
      contentLength: Number(row.content_length ?? 0),
      documentPath: this.toPublicDocumentUrl(row.document_path),
      actionDate: this.toDate(row.action_date),
      action: row.action,
      actionNumber: row.action_number,
      patentId: row.patent_id,
      applicationNumber: row.application_number,
      koreanTitle: row.korean_title,
      englishTitle: row.english_title,
      applicant: row.applicant,
      legalStatusId: row.legal_status_id,
      legalStatus: row.legal_status,
      examStatusId: row.exam_status_id,
      exam: row.exam,
      examiners: row.examiners ?? [],
      submissions,
      rejections: row.rejections ?? [],
      patent,
      filterIndex: {
        attorneyName: row.attorney_name,
        examStatus: row.exam_status,
        ipcs: row.ipcs ?? [],
      },
    };
  }
}
