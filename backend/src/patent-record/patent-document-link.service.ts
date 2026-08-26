import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { OaDatabaseService } from "../oa-database/oa-database.service";
import { PrismaService } from "../database/prisma.service";
import { PatentAuditService } from "./patent-audit.service";
import {
  checkLinkable,
  groupOaDocumentRows,
  type LinkDocumentsResult,
  type LinkedAdmin,
  type OaDocumentRow,
} from "./patent-document-link";

/** OA DB에서 특허 한 행. 문서 URL은 특허 자체에도 하나 붙어 있다(명세서·공보). */
type OaPatentRow = { id: number; document_path: string | null };

/**
 * 관리 특허 ← OA DB 문서 연결.
 *
 * 조회는 OA PostgreSQL(읽기 전용)에서 하고, 쓰기는 **우리 DB에만** 한다. 상류는 우리
 * 소유가 아니므로 손대지 않는다.
 *
 * 왜 조회만 하고 끝내지 않고 우리 테이블에 적재하는가:
 *
 *  - 문서 뷰어·목록 배지·상세의 '문서 N건 열기'가 이미 로컬 `admin → office_action →
 *    response`를 읽는다. 적재해 두면 그 셋이 손대지 않고 그대로 동작한다.
 *  - 상류가 느리거나 죽어도 한 번 이어 붙인 문서는 남는다. 조회로만 두면 화면이 상류의
 *    가용성에 매인다.
 *
 * PDF 원본은 복사하지 않는다 — `document_path`는 SeaweedFS의 절대 URL이고, 뷰어가 그
 * 주소를 직접 연다. 여기서 옮기는 것은 **어떤 문서가 이 특허의 것인가**라는 사실뿐이다.
 */
@Injectable()
export class PatentDocumentLinkService {
  private readonly logger = new Logger(PatentDocumentLinkService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly oa: OaDatabaseService,
    private readonly audit: PatentAuditService,
  ) {}

  async link(
    patentId: number,
    actorUserId: string | null = null,
    requestId: string | null = null,
  ): Promise<LinkDocumentsResult> {
    const patent = await this.prisma.client.patent.findUnique({
      where: { id: patentId },
      select: {
        id: true,
        applicationNumber: true,
        internalRef: true,
        documentPath: true,
      },
    });
    if (!patent) throw new NotFoundException("PATENT_NOT_FOUND");

    const check = checkLinkable(patent.applicationNumber);
    if (!check.linkable) {
      // 조회를 보내지 않는다. 찾을 수 있는 모양이 아니다.
      return this.emptyResult(
        check.reason,
        check.normalized,
        await this.countDocuments(patentId, patent.documentPath),
      );
    }

    const upstream = await this.findUpstreamPatent(check.normalized);
    if (!upstream) {
      return this.emptyResult(
        "NOT_FOUND_UPSTREAM",
        check.normalized,
        await this.countDocuments(patentId, patent.documentPath),
      );
    }

    const admins = groupOaDocumentRows(
      await this.findUpstreamDocuments(upstream.id),
    );
    const hasPatentDocument =
      Boolean(upstream.document_path) && upstream.document_path !== patent.documentPath;

    if (admins.length === 0 && !hasPatentDocument) {
      return this.emptyResult(
        "NO_DOCUMENTS",
        check.normalized,
        await this.countDocuments(patentId, patent.documentPath),
      );
    }

    const written = await this.writeLocal(patentId, admins, {
      documentPath: hasPatentDocument ? upstream.document_path : null,
    });

    if (
      written.created.admins +
        written.created.officeActions +
        written.created.responses >
        0 ||
      written.patentDocumentLinked
    ) {
      await this.recordLinked(patentId, patent, check.normalized, written, {
        actorUserId,
        requestId,
      });
    }

    return {
      matched: true,
      normalizedApplicationNumber: check.normalized,
      ...written,
      documentCount: await this.countDocuments(
        patentId,
        written.patentDocumentLinked ? upstream.document_path : patent.documentPath,
      ),
    };
  }

  /** 출원번호 한 건. OA DB의 출원번호는 유일하지만 방어적으로 하나만 받는다. */
  private async findUpstreamPatent(
    normalizedApplicationNumber: string,
  ): Promise<OaPatentRow | null> {
    const rows = await this.oa.query<OaPatentRow>(
      `select id, document_path
         from patent
        where application_number = $1
        limit 1`,
      [normalizedApplicationNumber],
    );
    return rows[0] ?? null;
  }

  /**
   * 이 특허의 통지서와 제출 서류. 한 줄이 `admin × office_action × response` 하나라
   * 계층은 groupOaDocumentRows가 되돌린다.
   */
  private async findUpstreamDocuments(
    upstreamPatentId: number,
  ): Promise<OaDocumentRow[]> {
    return this.oa.query<OaDocumentRow>(
      `select a.id            as admin_id,
              a.action,
              a.action_date,
              a.action_number,
              oa.id           as oa_id,
              oa.content      as oa_content,
              oa.document_path as oa_document_path,
              r.id            as response_id,
              r.type          as response_type,
              r.content       as response_content,
              r.document_path as response_document_path
         from admin a
         join office_action oa on oa.admin_id = a.id
         left join response r on r.oa_id = oa.id
        where a.patent_id = $1
        order by a.action_date nulls last, a.id, oa.id, r.id`,
      [upstreamPatentId],
    );
  }

  /**
   * 우리 테이블에 옮겨 담는다. **다시 눌러도 같은 문서면 아무것도 만들지 않는다.**
   *
   * 상류 id를 그대로 쓰지 않는 이유: 우리 테이블의 id는 autoincrement이고 이미 다른 행이
   * 쓰고 있다. 대신 사람이 보는 값으로 같은 것인지 판단한다 — 처분은 action_number(없으면
   * 처분명+일자), 문서는 document_path다. 같은 PDF를 두 번 매다는 일만 막으면 된다.
   */
  private async writeLocal(
    patentId: number,
    admins: LinkedAdmin[],
    patent: { documentPath: string | null },
  ) {
    const created = { admins: 0, officeActions: 0, responses: 0 };
    let skipped = 0;

    await this.prisma.client.$transaction(async (tx) => {
      if (patent.documentPath) {
        await tx.patent.update({
          where: { id: patentId },
          data: { documentPath: patent.documentPath },
        });
      }

      for (const admin of admins) {
        const existingAdmin = await tx.patentAdmin.findFirst({
          where: {
            patentId,
            ...(admin.actionNumber
              ? { actionNumber: admin.actionNumber }
              : { action: admin.action, actionDate: admin.actionDate }),
          },
          select: { id: true },
        });

        const adminId =
          existingAdmin?.id ??
          (
            await tx.patentAdmin.create({
              data: {
                patentId,
                action: admin.action,
                actionDate: admin.actionDate,
                actionNumber: admin.actionNumber,
              },
              select: { id: true },
            })
          ).id;
        if (!existingAdmin) created.admins += 1;

        for (const officeAction of admin.officeActions) {
          const existingOa = await tx.officeAction.findFirst({
            where: { adminId, documentPath: officeAction.documentPath },
            select: { id: true },
          });
          if (existingOa) skipped += 1;

          const oaId =
            existingOa?.id ??
            (
              await tx.officeAction.create({
                data: {
                  adminId,
                  content: officeAction.content,
                  documentPath: officeAction.documentPath,
                },
                select: { id: true },
              })
            ).id;
          if (!existingOa) created.officeActions += 1;

          for (const response of officeAction.responses) {
            const existingResponse = await tx.officeActionResponse.findFirst({
              where: { oaId, documentPath: response.documentPath },
              select: { id: true },
            });
            if (existingResponse) continue;

            await tx.officeActionResponse.create({
              data: {
                oaId,
                type: response.type,
                content: response.content,
                documentPath: response.documentPath,
              },
            });
            created.responses += 1;
          }
        }
      }
    });

    return {
      created,
      skipped,
      patentDocumentLinked: Boolean(patent.documentPath),
    };
  }

  /**
   * 목록 배지와 같은 기준으로 센다 — 통지서 하나가 한 건이고, 특허 단위 문서가 있으면
   * 거기에 하나를 더한다(뷰어가 그것도 한 항목으로 그린다).
   */
  private async countDocuments(
    patentId: number,
    patentDocumentPath: string | null,
  ): Promise<number> {
    const officeActions = await this.prisma.client.officeAction.count({
      where: { admin: { patentId } },
    });
    return officeActions + (patentDocumentPath ? 1 : 0);
  }

  private emptyResult(
    reason: LinkDocumentsResult["reason"],
    normalized: string,
    documentCount: number,
  ): LinkDocumentsResult {
    return {
      matched: false,
      reason,
      normalizedApplicationNumber: normalized,
      created: { admins: 0, officeActions: 0, responses: 0 },
      skipped: 0,
      patentDocumentLinked: false,
      documentCount,
    };
  }

  /** 활동 피드에 한 줄. 문서가 어디서 왔는지는 나중에 반드시 묻게 된다. */
  private async recordLinked(
    patentId: number,
    patent: { applicationNumber: string; internalRef: string | null },
    normalizedApplicationNumber: string,
    written: {
      created: { admins: number; officeActions: number; responses: number };
      patentDocumentLinked: boolean;
    },
    actor: { actorUserId: string | null; requestId: string | null },
  ): Promise<void> {
    try {
      await this.audit.recordEvent(this.prisma.client, {
        patentId,
        actorUserId: actor.actorUserId,
        requestId: actor.requestId,
        eventType: "PATENT_DOCUMENTS_LINKED",
        patent,
        extra: {
          source: "OA_DATABASE",
          normalizedApplicationNumber,
          linkedOfficeActions: written.created.officeActions,
          linkedResponses: written.created.responses,
          linkedPatentDocument: written.patentDocumentLinked,
        },
      });
    } catch (error) {
      // 이력을 남기지 못했다고 이미 이어 붙인 문서를 되돌리지는 않는다.
      this.logger.warn(
        `Failed to record document link audit for patent ${patentId}: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
      );
    }
  }
}
