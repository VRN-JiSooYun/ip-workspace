import { Injectable } from "@nestjs/common";
// 이 프로젝트는 @prisma/client가 아니라 generator output(src/generated/prisma)을 쓴다.
import type { PrismaClient } from "../generated/prisma/client";
import { PrismaService } from "../database/prisma.service";
import {
  AUDITED_FIELDS,
  diffAuditableFields,
  type AuditablePatent,
} from "./patent-audit-fields";

/**
 * 관리 특허 변경 이력 기록·조회.
 *
 * 기록은 갱신과 **같은 트랜잭션**에서 해야 한다(그래서 tx를 받는다). 따로 하면 갱신은
 * 됐는데 로그가 없거나, 로그만 남고 갱신이 롤백된 상태가 만들어진다.
 *
 * `auth_audit_log`를 쓰는 team-access-admin.service와 같은 규약이다 — actorUserId,
 * eventType, requestId, metadata(Json).
 */

/**
 * 트랜잭션 클라이언트에서 이 서비스가 쓰는 부분만.
 *
 * 손으로 쓴 모양이 아니라 생성된 client에서 뽑아 쓴다 — 직접 적으면 Prisma가 시그니처를
 * 바꿀 때 조용히 어긋난다. 테스트의 가짜 tx는 이 타입으로 캐스팅해 넘긴다.
 */
export type PatentAuditTx = Pick<PrismaClient, "patentAuditLog">;

export type PatentAuditEventType =
  | "PATENT_CREATED"
  | "PATENT_FIELD_CHANGED"
  | "PATENT_IMPORTED"
  | "PATENT_DELETED"
  /** OA DB에서 문서를 찾아 이어 붙였다. 어떤 문서가 어디서 왔는지는 반드시 묻게 된다. */
  | "PATENT_DOCUMENTS_LINKED";

type PatentIdentity = {
  applicationNumber: string;
  internalRef: string | null;
};

/**
 * 특허가 지워져도 어느 건이었는지 읽히게 늘 함께 담는 값.
 * patentId는 삭제 시 SetNull되므로 이것이 유일한 단서다.
 */
const identityMetadata = (patent: PatentIdentity) => ({
  applicationNumber: patent.applicationNumber,
  internalRef: patent.internalRef,
});

export type PatentAuditEntry = {
  id: string;
  eventType: PatentAuditEventType;
  field: string | null;
  /** 컬럼 이름을 화면에 쓸 이름으로 옮긴 것. 모르는 컬럼이면 null. */
  fieldLabel: string | null;
  beforeValue: string | null;
  afterValue: string | null;
  requestId: string | null;
  metadata: unknown;
  createdAt: string;
  actor: { id: string; name: string | null } | null;
};

@Injectable()
export class PatentAuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 달라진 필드마다 한 행. 달라진 것이 없으면 아무것도 쓰지 않는다.
   *
   * 값 비교로 판단하는 이유: 같은 값을 다시 보내는 PATCH(고쳤다 되돌림, 자동 저장 중복)로
   * 이력이 불어나면 피드를 못 쓴다.
   */
  async recordFieldChanges(
    tx: PatentAuditTx,
    params: {
      patentId: number;
      actorUserId: string | null;
      requestId: string | null;
      before: AuditablePatent;
      after: AuditablePatent;
    },
  ): Promise<void> {
    const changes = diffAuditableFields(params.before, params.after);
    if (changes.length === 0) return;

    await tx.patentAuditLog.createMany({
      data: changes.map((change) => ({
        patentId: params.patentId,
        actorUserId: params.actorUserId,
        eventType: "PATENT_FIELD_CHANGED",
        field: change.field,
        beforeValue: change.beforeValue,
        afterValue: change.afterValue,
        requestId: params.requestId,
        // 출원번호는 갱신으로 바뀔 수 있다. 갱신 후 값을 담아 지금의 그 건을 가리키게 한다.
        metadata: identityMetadata(params.after),
      })),
    });
  }

  /** 필드 단위가 아닌 사건(생성·삭제·임포트) 한 행. */
  async recordEvent(
    tx: PatentAuditTx,
    params: {
      patentId: number | null;
      actorUserId: string | null;
      requestId: string | null;
      eventType: Exclude<PatentAuditEventType, "PATENT_FIELD_CHANGED">;
      patent: PatentIdentity;
      /** 사건별 부가 정보. 임포트의 changedFields 같은 것. */
      extra?: Record<string, unknown>;
    },
  ): Promise<void> {
    await tx.patentAuditLog.create({
      data: {
        patentId: params.patentId,
        actorUserId: params.actorUserId,
        eventType: params.eventType,
        requestId: params.requestId,
        metadata: { ...identityMetadata(params.patent), ...(params.extra ?? {}) },
      },
    });
  }

  /**
   * 이 특허의 활동 피드. 최신순.
   *
   * cursor는 마지막으로 받은 로그 id다. createdAt이 같은 행이 여럿일 수 있어(한 요청에서
   * 여러 필드가 바뀌면 같은 시각이다) 시각이 아니라 id로 이어 받는다.
   */
  async list(
    patentId: number,
    options: { limit?: number; cursor?: string } = {},
  ): Promise<{ items: PatentAuditEntry[]; nextCursor: string | null }> {
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);

    const rows = await this.prisma.client.patentAuditLog.findMany({
      where: { patentId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      // 다음 페이지가 있는지 알려면 하나 더 받아 본다.
      take: limit + 1,
      ...(options.cursor
        ? { cursor: { id: options.cursor }, skip: 1 }
        : {}),
      include: { actor: { select: { id: true, name: true } } },
    });

    const page = rows.slice(0, limit);
    return {
      items: page.map((row) => ({
        id: row.id,
        eventType: row.eventType as PatentAuditEventType,
        field: row.field,
        fieldLabel: row.field ? (AUDITED_FIELDS[row.field]?.label ?? null) : null,
        beforeValue: row.beforeValue,
        afterValue: row.afterValue,
        requestId: row.requestId,
        metadata: row.metadata,
        createdAt: row.createdAt.toISOString(),
        actor: row.actor ? { id: row.actor.id, name: row.actor.name } : null,
      })),
      nextCursor: rows.length > limit ? page[page.length - 1].id : null,
    };
  }
}
