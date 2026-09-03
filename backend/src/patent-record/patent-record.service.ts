import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createDocumentUrlRewriter } from "../common/document-url";
import { PrismaService } from "../database/prisma.service";
import { buildInternalRefColumns, normalizeInternalRef } from "./internal-ref";
import type { CreatePatentRecordDto } from "./dto/create-patent-record.dto";
import type { PatentDeadlineQueryDto } from "./dto/patent-deadline-query.dto";
import type { PatentRecordListQueryDto } from "./dto/patent-record-list-query.dto";
import type { PatentScheduleQueryDto } from "./dto/patent-schedule-query.dto";
import type { PatentStageQueryDto } from "./dto/patent-stage-query.dto";
import {
  AWAITING_REGISTRATION_STAGE_CODE,
  PATENT_QUALITY_FILTERS,
  PATENT_QUALITY_FILTER_KEYS,
} from "./patent-quality";
import {
  countDocumentsByPatent,
  toPatentDocumentItems,
} from "./patent-record-documents";
import type { UpdatePatentRecordDto } from "./dto/update-patent-record.dto";
import { normalizeRichText } from "./rich-text";
import { PatentAuditService } from "./patent-audit.service";
import { buildPatentExportCsv } from "./patent-csv";

const LIST_INCLUDE = {
  country: { select: { id: true, country: true } },
  attorney: { select: { attorneyNumber: true, attorneyName: true } },
  legalStatus: { select: { id: true, status: true } },
  examStatus: { select: { id: true, status: true } },
  inventorLinks: {
    orderBy: { ordinal: "asc" as const },
    select: {
      inventorId: true,
      ordinal: true,
      inventor: { select: { id: true, inventor: true } },
    },
  },
} as const;

const ORDER_BY = {
  applicationDateDesc: [{ applicationDate: "desc" }, { id: "desc" }],
  applicationDateAsc: [{ applicationDate: "asc" }, { id: "asc" }],
  applicationNumberAsc: [{ applicationNumber: "asc" }],
  idDesc: [{ id: "desc" }],
} as const;

/** DTO의 날짜 문자열을 Date로 바꾼다. null은 column을 비우라는 뜻이라 그대로 통과시킨다. */
const toDate = (value: string | null | undefined): Date | null | undefined => {
  if (value === undefined || value === null) return value;
  return new Date(value);
};

const SCHEDULE_DATE_FIELDS = [
  ["applicationDate", "APPLICATION", "출원일"],
  ["publicationDate", "PUBLICATION", "공개일"],
  ["intApplicationDate", "INT_APPLICATION", "국제출원일"],
  ["intPublicationDate", "INT_PUBLICATION", "국제공개일"],
  ["examDate", "EXAM", "심사일"],
  ["expectedExpiryDate", "EXPECTED_EXPIRY", "예상 만료일"],
] as const;

const toDateKey = (value: Date): string => value.toISOString().slice(0, 10);

/** `YYYY-MM-DD`를 date-only UTC 시각으로. 시간대에 흔들리지 않게 UTC 자정으로 고정한다. */
const fromDateKey = (value: string): Date => {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

const addDays = (value: Date, days: number): Date => (
  new Date(value.getTime() + days * 86_400_000)
);

/**
 * 서비스 기준 시간대(Asia/Seoul)의 오늘을 date-only UTC 시각으로.
 * schedule()이 쓰던 계산과 같은 것을 함수로 뽑았다.
 */
const seoulToday = (): Date => {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
};

/** 마감 항목이 물고 나가는 특허 정보. 기한 보드가 한 줄에 그리는 것만 고른다. */
const DEADLINE_PATENT_SELECT = {
  id: true,
  internalRef: true,
  applicationNumber: true,
  koreanTitle: true,
  englishTitle: true,
  target: true,
  country: { select: { country: true } },
} as const;

type DeadlinePatent = {
  id: number;
  internalRef: string | null;
  applicationNumber: string;
  koreanTitle: string | null;
  englishTitle: string | null;
  target: string | null;
  country: { country: string };
};

const toDeadlineCommon = (patent: DeadlinePatent) => ({
  patentId: patent.id,
  internalRef: patent.internalRef,
  applicationNumber: patent.applicationNumber,
  patentTitle: patent.koreanTitle ?? patent.englishTitle,
  country: patent.country.country,
  target: patent.target,
});

/** 빈 문자열과 공백만 있는 값을 걸러낸 Target 목록. 없으면 undefined(=필터 없음). */
const normalizeTargets = (targets: string[] | undefined): string[] | undefined => {
  const cleaned = targets
    ?.map((target) => target.trim())
    .filter((target) => target.length > 0);
  return cleaned?.length ? cleaned : undefined;
};

/**
 * 진행 단계에 연결되지 않은 건을 가리키는 예약 값. 집계 응답과 목록 필터가 함께 쓴다.
 * 미분류를 조용히 버리면 파이프라인 합계가 목록 총건수와 어긋나 신뢰를 잃는다.
 */
export const UNMAPPED_STAGE_GROUP = "UNMAPPED";

const parseRegistrationDate = (value: string | null): string | null => {
  if (!value) return null;
  const match = /^(\d{4})[-.](\d{2})[-.](\d{2})/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
    ? `${match[1]}-${match[2]}-${match[3]}`
    : null;
};

/**
 * `response.type`은 코드 테이블 없이 정수만 들어 있다. 운영에서 쓰는 값만 이름을 붙이고
 * 모르는 값은 일반 명칭으로 접는다. 코드 테이블이 생기면 이 표를 지우고 join으로 바꾼다.
 */
const RESPONSE_TYPE_LABELS: Record<number, string> = {
  1: "의견서",
  2: "보정서",
  3: "의견서 · 보정서",
};

@Injectable()
export class PatentRecordService {
  /**
   * 사내망 문서 주소 → 밖에서 닿는 주소. PATENT_DOCUMENT_BASE_URL이 없으면 그대로 통과시킨다.
   * 검색 화면(PatentSearchService)과 같은 규칙을 쓴다 — 같은 문서를 같은 뷰어가 연다.
   */
  private readonly toPublicDocumentUrl: (value: string | null | undefined) => string | null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: PatentAuditService,
    config: ConfigService,
  ) {
    this.toPublicDocumentUrl = createDocumentUrlRewriter(
      config.get<string | null>("documents.fileOrigin", null),
    );
  }

  /**
   * 목록과 진행 현황 집계가 같은 모집단을 보게 하려고 where를 한 곳에서 만든다.
   * 여기가 갈리면 파이프라인 합계와 목록 총건수가 어긋난다.
   *
   * 조건이 여러 개일 때 OR가 서로를 덮어쓰지 않도록 AND 배열에 담는다.
   */
  private buildListWhere(query: PatentStageQueryDto) {
    const q = query.q?.trim();
    const targets = query.targets
      ?.map((target) => target.trim())
      .filter((target) => target.length > 0);
    const and: Record<string, unknown>[] = [];

    if (q) {
      and.push({
        OR: [
          { internalRef: { contains: q, mode: "insensitive" as const } },
          { applicationNumber: { contains: q, mode: "insensitive" as const } },
          { koreanTitle: { contains: q, mode: "insensitive" as const } },
          { englishTitle: { contains: q, mode: "insensitive" as const } },
          { applicant: { contains: q, mode: "insensitive" as const } },
          {
            inventorLinks: {
              some: {
                inventor: {
                  inventor: { contains: q, mode: "insensitive" as const },
                },
              },
            },
          },
        ],
      });
    }

    // ---- 컬럼별 조건 ------------------------------------------------------
    // 문자열은 전부 대소문자 무시 부분 일치. 빈 문자열은 조건 없음으로 다룬다
    // (프런트가 입력을 비웠을 때 `contains: ""`로 전체를 훑지 않게).
    const like = (value: string | undefined) => {
      const trimmed = value?.trim();
      return trimmed ? { contains: trimmed, mode: "insensitive" as const } : undefined;
    };

    const internalRef = like(query.internalRef);
    if (internalRef) and.push({ internalRef });

    const applicationNumber = like(query.applicationNumber);
    if (applicationNumber) and.push({ applicationNumber });

    const applicant = like(query.applicant);
    if (applicant) and.push({ applicant });

    const registrationNumber = like(query.registrationNumber);
    if (registrationNumber) and.push({ registrationNumber });

    // 명칭은 국문·영문 두 컬럼에 나뉘어 있다. 어느 쪽이 채워졌는지 사용자가 알 수 없으니
    // 둘 중 하나만 걸려도 통과시킨다(표에서도 국문 없으면 영문을 보여 준다).
    const title = like(query.title);
    if (title) {
      and.push({ OR: [{ koreanTitle: title }, { englishTitle: title }] });
    }

    if (query.attorneyNumber !== undefined) {
      and.push({ attorneyNumber: query.attorneyNumber });
    }

    // 상세 검색 select의 정본은 OA DB다. 두 DB의 정수 ID는 같다고 보장할 수 없으므로
    // 외부 option은 명칭으로 받고, 로컬 관계 테이블의 명칭과 대소문자 없이 맞춘다.
    const exact = (value: string | undefined) => {
      const trimmed = value?.trim();
      return trimmed ? { equals: trimmed, mode: "insensitive" as const } : undefined;
    };
    const countryText = exact(query.countryText);
    if (countryText) and.push({ country: { country: countryText } });
    const legalStatusText = exact(query.legalStatusText);
    if (legalStatusText) and.push({ legalStatus: { status: legalStatusText } });
    const examStatusText = exact(query.examStatusText);
    if (examStatusText) and.push({ examStatus: { status: examStatusText } });

    // 출원일 기간. 끝 날짜는 그 날을 포함해야 하므로 다음 날 0시 미만으로 본다
    // (applicationDate가 DateTime이라 lte로 자르면 그 날 00:00만 걸린다).
    if (query.applicationDateFrom || query.applicationDateTo) {
      const range: Record<string, Date> = {};
      if (query.applicationDateFrom) {
        range.gte = new Date(`${query.applicationDateFrom}T00:00:00.000Z`);
      }
      if (query.applicationDateTo) {
        const end = new Date(`${query.applicationDateTo}T00:00:00.000Z`);
        end.setUTCDate(end.getUTCDate() + 1);
        range.lt = end;
      }
      and.push({ applicationDate: range });
    }

    // 문서 유무. 문서는 patent → admin → office_action에 매달려 있어 관계 두 단계를
    // 타고 들어간다(patent-record-documents.ts의 세는 경로와 같다).
    if (query.hasDocuments !== undefined) {
      const hasOfficeAction = { admins: { some: { officeActions: { some: {} } } } };
      and.push(query.hasDocuments ? hasOfficeAction : { NOT: hasOfficeAction });
    }

    if (query.stageGroup === UNMAPPED_STAGE_GROUP) {
      // status가 없거나, 있어도 단계에 연결되지 않은 건. 대시보드 품질 카드가 세는
      // 조건과 같아야 하므로 표현식을 복제하지 않고 정본을 그대로 쓴다.
      and.push({ ...PATENT_QUALITY_FILTERS.unmappedStatus });
    } else if (query.stageGroup) {
      and.push({ legalStatus: { stage: { groupCode: query.stageGroup } } });
    }

    // 세부 단계. 대분류와 같은 관계를 한 칸 더 좁혀 들어간다.
    if (query.stageCode) {
      and.push({ legalStatus: { stageCode: query.stageCode } });
    }

    // 데이터 품질 조건. 표는 patent-quality.ts가 정본이라 대시보드 품질 카드의
    // 건수와 이 필터를 걸었을 때의 목록 총건수가 같은 정의를 공유한다.
    if (query.quality) {
      and.push({ ...PATENT_QUALITY_FILTERS[query.quality] });
    }

    return {
      ...(query.countryId ? { countryId: query.countryId } : {}),
      ...(query.legalStatusId ? { legalStatusId: query.legalStatusId } : {}),
      ...(query.examStatusId ? { examStatusId: query.examStatusId } : {}),
      ...(targets?.length ? { target: { in: targets } } : {}),
      ...(and.length ? { AND: and } : {}),
    };
  }

  async list(query: PatentRecordListQueryDto) {
    const where = this.buildListWhere(query);

    const [total, items] = await Promise.all([
      this.prisma.client.patent.count({ where }),
      this.prisma.client.patent.findMany({
        where,
        include: LIST_INCLUDE,
        orderBy: [...ORDER_BY[query.sort]],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    const documentCounts = await this.countDocuments(items.map((item) => item.id));

    return {
      items: items.map((item) => ({
        ...item,
        documentCount: documentCounts.get(item.id) ?? 0,
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /** 페이지 구분 없이 현재 목록 조건에 맞는 전체 특허를 CSV로 내보낸다. */
  async exportCsv(query: PatentRecordListQueryDto): Promise<string> {
    const items = await this.prisma.client.patent.findMany({
      where: this.buildListWhere(query),
      include: LIST_INCLUDE,
      orderBy: [...ORDER_BY[query.sort]],
    });
    return buildPatentExportCsv(items);
  }

  /**
   * 목록 한 페이지 분량의 문서 건수. 통지서 1건 + 그 아래 제출 서류 n건으로 센다
   * (listDocuments가 펼치는 것과 같은 기준이라 배지 숫자와 뷰어 목록 길이가 일치한다).
   *
   * 목록 include에 넣지 않고 따로 세는 이유: 문서는 admin을 한 단계 거쳐 매달려 있어
   * Prisma의 `_count`로는 한 번에 못 세고, 중첩 include로 끌어오면 목록 응답에 본문까지
   * 딸려 온다. 페이지에 보이는 id만 모아 한 번 더 묻는 편이 싸다.
   */
  private async countDocuments(patentIds: number[]): Promise<Map<number, number>> {
    if (patentIds.length === 0) return new Map();

    const [admins, withPatentDocument] = await Promise.all([
      this.prisma.client.patentAdmin.findMany({
        where: { patentId: { in: patentIds } },
        select: { patentId: true, _count: { select: { officeActions: true } } },
      }),
      // 특허 문서는 admin을 거치지 않아 위 조회에 잡히지 않는다. 배지가 뷰어 목록보다
      // 하나 모자라지 않으려면 여기서 따로 센다.
      this.prisma.client.patent.findMany({
        where: { id: { in: patentIds }, documentPath: { not: null } },
        select: { id: true },
      }),
    ]);

    return countDocumentsByPatent(
      admins,
      withPatentDocument.map((patent) => patent.id),
    );
  }

  /**
   * 관리 특허 한 건에 딸린 문서 목록.
   *
   * ERD상 문서는 `patent → admin → office_action`(통지서)과 그 아래
   * `response`(의견서·보정서)에 매달려 있다. 화면에서는 이 두 계층을 구분할 이유가 없어
   * 한 줄짜리 목록으로 펼쳐서 준다. 정렬은 처분일 최신순, 같은 날이면 통지서 → 응답 순.
   */
  async listDocuments(patentId: number) {
    const patent = await this.prisma.client.patent.findUnique({
      where: { id: patentId },
      select: {
        id: true,
        applicationNumber: true,
        koreanTitle: true,
        englishTitle: true,
        applicant: true,
        legalStatusId: true,
        legalStatus: { select: { status: true } },
        examStatusId: true,
        examStatus: { select: { status: true } },
        exam: true,
        documentPath: true,
      },
    });
    if (!patent) throw new NotFoundException("PATENT_NOT_FOUND");

    const admins = await this.prisma.client.patentAdmin.findMany({
      where: { patentId },
      orderBy: [{ actionDate: "desc" }, { id: "desc" }],
      select: {
        id: true,
        action: true,
        actionDate: true,
        actionNumber: true,
        officeActions: {
          orderBy: { id: "asc" },
          select: {
            id: true,
            content: true,
            documentPath: true,
            responses: {
              orderBy: { id: "asc" },
              select: { id: true, type: true, content: true, documentPath: true },
            },
            oaExaminers: {
              select: {
                examiner: {
                  select: {
                    id: true,
                    office: true,
                    bureau: true,
                    department: true,
                    name: true,
                  },
                },
              },
            },
            rejections: {
              orderBy: { id: "asc" },
              select: {
                id: true,
                claim: true,
                statute: {
                  select: {
                    lawType: true,
                    article: true,
                    paragraph: true,
                    subParagraph: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    return {
      patentId,
      items: toPatentDocumentItems(patent, admins, this.toPublicDocumentUrl),
    }
  }

  /** 관리 가능한 Target 코드와 각 코드의 관리 특허 건수. */
  async listTargets() {
    const rows = await this.prisma.client.patentTarget.findMany({
      orderBy: { target: "asc" },
      include: { _count: { select: { patents: true } } },
    });
    return rows.map((row) => ({
      target: row.target,
      count: row._count.patents,
    }));
  }

  /**
   * 진행 현황 파이프라인용 집계. 목록과 같은 필터(q·targets·...)를 받아
   * legal_status → patent_stage 매핑을 따라 단계별 건수를 낸다.
   *
   * 단계 정의는 patent_stage 테이블이 정본이다(docs/patent_stage_definitions.md).
   * 매핑되지 않은 status는 버리지 않고 unmapped로 함께 돌려준다.
   */
  async stages(query: PatentStageQueryDto) {
    const where = this.buildListWhere(query);

    const [groups, statuses, grouped, total] = await Promise.all([
      this.prisma.client.patentStageGroup.findMany({
        orderBy: { ordinal: "asc" },
        include: { stages: { orderBy: { ordinal: "asc" } } },
      }),
      this.prisma.client.legalStatus.findMany({
        select: { id: true, status: true, stageCode: true },
      }),
      this.prisma.client.patent.groupBy({
        by: ["legalStatusId"],
        where,
        _count: { _all: true },
      }),
      this.prisma.client.patent.count({ where }),
    ]);

    const statusById = new Map(statuses.map((row) => [row.id, row]));
    const countByStage = new Map<string, number>();
    const unmappedStatuses: {
      legalStatusId: number | null;
      status: string | null;
      count: number;
    }[] = [];

    for (const row of grouped) {
      const count = row._count._all;
      const status =
        row.legalStatusId === null
          ? undefined
          : statusById.get(row.legalStatusId);

      if (!status?.stageCode) {
        unmappedStatuses.push({
          legalStatusId: row.legalStatusId,
          status: status?.status ?? null,
          count,
        });
        continue;
      }

      countByStage.set(
        status.stageCode,
        (countByStage.get(status.stageCode) ?? 0) + count,
      );
    }

    return {
      total,
      groups: groups.map((group) => {
        const stages = group.stages.map((stage) => ({
          code: stage.code,
          label: stage.label,
          description: stage.description,
          scope: stage.scope,
          active: stage.active,
          count: countByStage.get(stage.code) ?? 0,
        }));
        return {
          code: group.code,
          label: group.label,
          ordinal: group.ordinal,
          count: stages.reduce((sum, stage) => sum + stage.count, 0),
          stages,
        };
      }),
      unmapped: {
        groupCode: UNMAPPED_STAGE_GROUP,
        count: unmappedStatuses.reduce((sum, row) => sum + row.count, 0),
        statuses: unmappedStatuses.sort((a, b) => b.count - a.count),
      },
    };
  }

  /**
   * 대시보드 기한 보드용 마감 목록.
   *
   * 마감으로 세는 것은 두 가지뿐이다: 미완료 To-do의 마감일과 특허의 예상 만료일.
   * 출원일·공개일·등록일은 이미 일어난 사실이지 마감이 아니라서 넣지 않는다
   * (등록일은 String column이라 범위 조회도 못 한다 — parseRegistrationDate 참고).
   *
   * 월 단위인 schedule()과 따로 두는 이유: 캘린더는 "언제"를 묻고 이 화면은 "무엇이
   * 급한가"를 묻는다. 달 경계에서 잘리면 후자가 성립하지 않는다.
   */
  async deadlines(query: PatentDeadlineQueryDto) {
    const targets = normalizeTargets(query.targets);
    const patentWhere = targets?.length ? { target: { in: targets } } : {};

    const rangeStart = fromDateKey(query.from);
    // to는 포함이므로 다음 날 자정을 상한(exclusive)으로 쓴다.
    const rangeEnd = addDays(fromDateKey(query.to), 1);
    const range = { gte: rangeStart, lt: rangeEnd };

    const [todos, expiring, todoTotal, expiryTotal, counts] = await Promise.all([
      this.prisma.client.patentTodo.findMany({
        where: { patent: patentWhere, completed: false, dueDate: range },
        orderBy: [{ dueDate: "asc" }, { id: "asc" }],
        take: query.limit,
        select: {
          id: true,
          title: true,
          dueDate: true,
          patent: { select: DEADLINE_PATENT_SELECT },
        },
      }),
      this.prisma.client.patent.findMany({
        where: { ...patentWhere, expectedExpiryDate: range },
        orderBy: [{ expectedExpiryDate: "asc" }, { id: "asc" }],
        take: query.limit,
        select: { ...DEADLINE_PATENT_SELECT, expectedExpiryDate: true },
      }),
      this.prisma.client.patentTodo.count({
        where: { patent: patentWhere, completed: false, dueDate: range },
      }),
      this.prisma.client.patent.count({
        where: { ...patentWhere, expectedExpiryDate: range },
      }),
      this.countDeadlineBuckets(patentWhere),
    ]);

    const items = [
      ...todos.flatMap((todo) =>
        todo.dueDate
          ? [
              {
                ...toDeadlineCommon(todo.patent),
                todoId: todo.id,
                todoTitle: todo.title,
                type: "TODO" as const,
                label: "To-do 마감일",
                date: toDateKey(todo.dueDate),
              },
            ]
          : [],
      ),
      ...expiring.flatMap((patent) =>
        patent.expectedExpiryDate
          ? [
              {
                ...toDeadlineCommon(patent),
                todoId: null,
                todoTitle: null,
                type: "EXPECTED_EXPIRY" as const,
                label: "예상 만료일",
                date: toDateKey(patent.expectedExpiryDate),
              },
            ]
          : [],
      ),
    ]
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          a.applicationNumber.localeCompare(b.applicationNumber) ||
          a.label.localeCompare(b.label),
      )
      // 원본별로 limit만큼 가져왔으므로 합친 뒤 다시 자른다. 전체에서 앞 limit개는
      // 각 원본의 앞 limit개 안에 반드시 들어 있다(둘 다 date 오름차순이므로).
      .slice(0, query.limit);

    return {
      from: toDateKey(rangeStart),
      to: query.to.slice(0, 10),
      items,
      // 잘렸는지를 화면이 알 수 있게 전체 건수를 함께 준다. 조용히 자르지 않는다.
      total: todoTotal + expiryTotal,
      counts,
    };
  }

  /**
   * 대시보드 KPI + 데이터 품질 집계.
   *
   * 위젯마다 따로 부르면 첫 렌더에 요청이 여러 번 나가고 화면 안에서 숫자가 서로
   * 다른 시점을 보게 된다. 한 번에 묶어 같은 스냅샷을 준다.
   *
   * 필터는 목록·진행 현황과 같은 DTO를 받아 모집단을 맞춘다. 단 `quality`는 무시한다
   * (품질 조건으로 걸러 놓고 그 품질 건수를 세면 순환이다).
   */
  async summary(query: PatentStageQueryDto) {
    const where = this.buildListWhere({ ...query, quality: undefined });
    const today = seoulToday();

    const [total, counts, expiringWithinYear, awaitingRegistration, quality] =
      await Promise.all([
        this.prisma.client.patent.count({ where }),
        this.countDeadlineBuckets(where),
        this.prisma.client.patent.count({
          where: {
            ...where,
            expectedExpiryDate: { gte: today, lt: addDays(today, 366) },
          },
        }),
        this.prisma.client.patent.count({
          where: {
            ...where,
            legalStatus: { stageCode: AWAITING_REGISTRATION_STAGE_CODE },
          },
        }),
        this.countQuality(where),
      ]);

    return {
      total,
      deadlines: counts,
      expiringWithinYear,
      awaitingRegistration,
      quality,
    };
  }

  /**
   * 오늘 기준 마감 버킷별 건수. 기한 보드와 KPI가 같은 함수를 쓰므로 두 숫자가
   * 어긋나지 않는다.
   *
   * 버킷은 서로 겹치지 않는다(기한 보드가 한 건을 한 줄에만 그려야 한다):
   *   overdue  … date <  오늘
   *   today    … date == 오늘
   *   within7  … 오늘 <  date <= 오늘+7
   *   within30 … 오늘+7 < date <= 오늘+30
   */
  private async countDeadlineBuckets(patentWhere: Record<string, unknown>) {
    const today = seoulToday();
    const countRange = async (range: { gte?: Date; lt?: Date }) => {
      const [todoCount, expiryCount] = await Promise.all([
        this.prisma.client.patentTodo.count({
          where: { patent: patentWhere, completed: false, dueDate: range },
        }),
        this.prisma.client.patent.count({
          where: { ...patentWhere, expectedExpiryDate: range },
        }),
      ]);
      return todoCount + expiryCount;
    };

    const [overdue, todayCount, within7, within30] = await Promise.all([
      countRange({ lt: today }),
      countRange({ gte: today, lt: addDays(today, 1) }),
      countRange({ gte: addDays(today, 1), lt: addDays(today, 8) }),
      countRange({ gte: addDays(today, 8), lt: addDays(today, 31) }),
    ]);

    return { overdue, today: todayCount, within7, within30 };
  }

  /** 품질 조건별 건수. 조건 표는 patent-quality.ts가 정본이다. */
  private async countQuality(where: Record<string, unknown>) {
    const entries = await Promise.all(
      PATENT_QUALITY_FILTER_KEYS.map(async (key) => {
        const count = await this.prisma.client.patent.count({
          where: { ...where, AND: [
            ...(Array.isArray(where.AND) ? where.AND : []),
            { ...PATENT_QUALITY_FILTERS[key] },
          ] },
        });
        return [key, count] as const;
      }),
    );
    return Object.fromEntries(entries) as Record<
      (typeof PATENT_QUALITY_FILTER_KEYS)[number],
      number
    >;
  }

  async schedule(query: PatentScheduleQueryDto) {
    const targets = query.targets
      ?.map((target) => target.trim())
      .filter((target) => target.length > 0);
    const targetWhere = targets?.length ? { target: { in: targets } } : {};
    const todoTargetWhere = targets?.length
      ? { patent: { target: { in: targets } } }
      : {};
    const monthStart = new Date(Date.UTC(query.year, query.month - 1, 1));
    const monthEnd = new Date(Date.UTC(query.year, query.month, 1));
    const monthPrefixDash = `${query.year}-${String(query.month).padStart(2, "0")}`;
    const monthPrefixDot = `${query.year}.${String(query.month).padStart(2, "0")}`;
    // 서비스 기준 시간대(Asia/Seoul)의 오늘을 date-only UTC key로 만든다.
    const today = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const todayStart = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
    );

    const dateRange = { gte: monthStart, lt: monthEnd };
    const scheduleSelect = {
      id: true,
      internalRef: true,
      applicationNumber: true,
      koreanTitle: true,
      englishTitle: true,
      target: true,
      country: { select: { country: true } },
      applicationDate: true,
      registrationDate: true,
      publicationDate: true,
      intApplicationDate: true,
      intPublicationDate: true,
      examDate: true,
      expectedExpiryDate: true,
    } as const;
    const todoSelect = {
      id: true,
      title: true,
      description: true,
      dueDate: true,
      completed: true,
      patent: {
        select: {
          id: true,
          internalRef: true,
          applicationNumber: true,
          koreanTitle: true,
          englishTitle: true,
          target: true,
          country: { select: { country: true } },
        },
      },
    } as const;

    const [monthPatents, monthTodos, overdueTodos, upcomingTodos, todoTotal] =
      await Promise.all([
        this.prisma.client.patent.findMany({
          where: {
            ...targetWhere,
            OR: [
              { applicationDate: dateRange },
              { publicationDate: dateRange },
              { intApplicationDate: dateRange },
              { intPublicationDate: dateRange },
              { examDate: dateRange },
              { expectedExpiryDate: dateRange },
              { registrationDate: { startsWith: monthPrefixDash } },
              { registrationDate: { startsWith: monthPrefixDot } },
            ],
          },
          select: scheduleSelect,
        }),
        this.prisma.client.patentTodo.findMany({
          where: {
            ...todoTargetWhere,
            completed: false,
            dueDate: dateRange,
          },
          orderBy: { dueDate: "asc" },
          select: todoSelect,
        }),
        this.prisma.client.patentTodo.findMany({
          where: {
            ...todoTargetWhere,
            completed: false,
            dueDate: { lt: todayStart },
          },
          orderBy: { dueDate: "desc" },
          take: 3,
          select: todoSelect,
        }),
        this.prisma.client.patentTodo.findMany({
          where: {
            ...todoTargetWhere,
            completed: false,
            dueDate: { gte: todayStart },
          },
          orderBy: { dueDate: "asc" },
          take: 7,
          select: todoSelect,
        }),
        this.prisma.client.patentTodo.count({
          where: {
            ...todoTargetWhere,
            completed: false,
            dueDate: { not: null },
          },
        }),
      ]);

    const patentEvents = monthPatents
      .flatMap((patent) => {
        const common = {
          patentId: patent.id,
          internalRef: patent.internalRef,
          applicationNumber: patent.applicationNumber,
          title: patent.koreanTitle ?? patent.englishTitle,
          country: patent.country.country,
          target: patent.target,
        };
        const typedEvents = SCHEDULE_DATE_FIELDS.flatMap(
          ([field, type, label]) => {
            const value = patent[field];
            if (!(value instanceof Date)) return [];
            const date = toDateKey(value);
            if (date < toDateKey(monthStart) || date >= toDateKey(monthEnd)) {
              return [];
            }
            return [{ ...common, type, label, date }];
          },
        );
        const registrationDate = parseRegistrationDate(
          patent.registrationDate,
        );
        return registrationDate && registrationDate.startsWith(monthPrefixDash)
          ? [
              ...typedEvents,
              {
                ...common,
                type: "REGISTRATION" as const,
                label: "등록일",
                date: registrationDate,
              },
            ]
          : typedEvents;
      })
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          a.label.localeCompare(b.label) ||
          a.applicationNumber.localeCompare(b.applicationNumber),
      );

    const todoEvents = monthTodos.flatMap((todo) =>
      todo.dueDate
        ? [
            {
              patentId: todo.patent.id,
              todoId: todo.id,
              internalRef: todo.patent.internalRef,
              applicationNumber: todo.patent.applicationNumber,
              title: todo.title,
              country: todo.patent.country.country,
              target: todo.patent.target,
              type: "TODO" as const,
              label: "To-do 마감일",
              date: toDateKey(todo.dueDate),
            },
          ]
        : [],
    );

    const events = [...patentEvents, ...todoEvents].sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.label.localeCompare(b.label) ||
        a.applicationNumber.localeCompare(b.applicationNumber),
    );

    const todos = [...overdueTodos, ...upcomingTodos].flatMap(
      (todo) =>
        todo.dueDate
          ? [
              {
                todoId: todo.id,
                patentId: todo.patent.id,
                internalRef: todo.patent.internalRef,
                applicationNumber: todo.patent.applicationNumber,
                patentTitle:
                  todo.patent.koreanTitle ?? todo.patent.englishTitle,
                title: todo.title,
                description: todo.description,
                country: todo.patent.country.country,
                target: todo.patent.target,
                dueDate: toDateKey(todo.dueDate),
              },
            ]
          : [],
    );

    return { year: query.year, month: query.month, events, todos, todoTotal };
  }

  async get(id: number) {
    const patent = await this.prisma.client.patent.findUnique({
      where: { id },
      include: LIST_INCLUDE,
    });
    if (!patent) throw new NotFoundException("PATENT_RECORD_NOT_FOUND");
    return patent;
  }

  /** 추가·변경 modal의 select 옵션. */
  async listLookups() {
    const [
      countries,
      attorneys,
      legalStatuses,
      examStatuses,
      targets,
      applicants,
      inventors,
    ] =
      await Promise.all([
        this.prisma.client.country.findMany({ orderBy: { country: "asc" } }),
        this.prisma.client.attorney.findMany({
          orderBy: { attorneyNumber: "asc" },
        }),
        // select를 명시해 프런트 타입(id·status)과 응답을 맞춘다. 컬럼을 추가해도
        // 코드 목록 응답이 함께 커지지 않는다.
        this.prisma.client.legalStatus.findMany({
          select: { id: true, status: true },
          orderBy: { status: "asc" },
        }),
        this.prisma.client.examStatus.findMany({ orderBy: { status: "asc" } }),
        this.prisma.client.patentTarget.findMany({
          orderBy: { target: "asc" },
        }),
        this.prisma.client.patentApplicant.findMany({
          orderBy: { applicant: "asc" },
        }),
        this.prisma.client.patentInventor.findMany({
          orderBy: { inventor: "asc" },
        }),
      ]);
    return {
      countries,
      attorneys,
      legalStatuses,
      examStatuses,
      targets,
      applicants,
      inventors,
    };
  }

  async create(
    dto: CreatePatentRecordDto,
    actorUserId: string | null = null,
    requestId: string | null = null,
  ) {
    await this.assertReferencesExist(dto);
    await this.assertApplicationNumberFree(dto.applicationNumber);
    await this.assertInternalRefFree(dto.internalRef);

    // 생성과 로그를 한 트랜잭션에 둔다. 따로 하면 로그만 남고 생성이 실패한(또는 반대)
    // 상태가 만들어진다.
    return this.prisma.client.$transaction(async (tx) => {
      const created = await tx.patent.create({
        data: {
          countryId: dto.countryId,
          applicationNumber: dto.applicationNumber,
          ...buildInternalRefColumns(dto.internalRef),
          koreanTitle: dto.koreanTitle ?? null,
          englishTitle: dto.englishTitle ?? null,
          applicationDate: toDate(dto.applicationDate) ?? null,
          applicant: toTrimmedText(dto.applicant) ?? null,
          ...(dto.inventorIds?.length
            ? {
                inventorLinks: {
                  create: dto.inventorIds.map((inventorId, ordinal) => ({
                    inventorId,
                    ordinal,
                  })),
                },
              }
            : {}),
          attorneyNumber: dto.attorneyNumber ?? null,
          registrationNumber: dto.registrationNumber ?? null,
          registrationDate: dto.registrationDate ?? null,
          publicationNumber: dto.publicationNumber ?? null,
          publicationDate: toDate(dto.publicationDate) ?? null,
          intApplicationNumber: dto.intApplicationNumber ?? null,
          intApplicationDate: toDate(dto.intApplicationDate) ?? null,
          intPublicationNumber: dto.intPublicationNumber ?? null,
          intPublicationDate: toDate(dto.intPublicationDate) ?? null,
          parentApplicationNumber: dto.parentApplicationNumber ?? null,
          legalStatusId: dto.legalStatusId ?? null,
          examStatusId: dto.examStatusId ?? null,
          exam: dto.exam ?? null,
          examDate: toDate(dto.examDate) ?? null,
          target: toTrimmedText(dto.target) ?? null,
        },
        include: LIST_INCLUDE,
      });

      await this.audit.recordEvent(tx, {
        patentId: created.id,
        actorUserId,
        requestId,
        eventType: "PATENT_CREATED",
        patent: created,
      });

      return created;
    });
  }

  async update(
    id: number,
    dto: UpdatePatentRecordDto,
    actorUserId: string | null = null,
    requestId: string | null = null,
  ) {
    // 존재 확인과 '변경 전' 값을 한 번에 얻는다.
    const before = await this.get(id);
    await this.assertReferencesExist(dto);
    if (dto.applicationNumber !== undefined) {
      await this.assertApplicationNumberFree(dto.applicationNumber, id);
    }
    if (dto.internalRef !== undefined) {
      await this.assertInternalRefFree(dto.internalRef, id);
    }

    // 전달된 key만 골라낸다. undefined를 그대로 넘기면 Prisma가 무시하지만,
    // null은 명시적으로 column을 비우는 의미라 구분해서 통과시켜야 한다.
    const data = {
      ...pick(dto, "countryId"),
      ...pick(dto, "applicationNumber"),
      // 원문이 바뀌면 파생 컬럼도 같은 트랜잭션에서 다시 계산해야 어긋나지 않는다.
      ...(dto.internalRef !== undefined
        ? buildInternalRefColumns(dto.internalRef)
        : {}),
      ...pick(dto, "koreanTitle"),
      ...pick(dto, "englishTitle"),
      ...pickDate(dto, "applicationDate"),
      ...(dto.applicant !== undefined
        ? { applicant: toTrimmedText(dto.applicant) }
        : {}),
      ...(dto.inventorIds !== undefined
        ? {
            inventorLinks: {
              deleteMany: {},
              create: dto.inventorIds.map((inventorId, ordinal) => ({
                inventorId,
                ordinal,
              })),
            },
          }
        : {}),
      ...pick(dto, "attorneyNumber"),
      ...pick(dto, "registrationNumber"),
      ...pick(dto, "registrationDate"),
      ...pick(dto, "publicationNumber"),
      ...pickDate(dto, "publicationDate"),
      ...pick(dto, "intApplicationNumber"),
      ...pickDate(dto, "intApplicationDate"),
      ...pick(dto, "intPublicationNumber"),
      ...pickDate(dto, "intPublicationDate"),
      ...pick(dto, "parentApplicationNumber"),
      ...pick(dto, "legalStatusId"),
      ...pick(dto, "examStatusId"),
      ...pick(dto, "exam"),
      ...pickDate(dto, "examDate"),
      ...(dto.target !== undefined
        ? { target: toTrimmedText(dto.target) }
        : {}),
      // 설명은 서식 있는 HTML이라 trim으로는 빈 값을 가려내지 못한다(`<p><br></p>`).
      ...(dto.note !== undefined ? { note: normalizeRichText(dto.note) } : {}),
    };

    // 갱신과 로그를 한 트랜잭션에 둔다. before는 위에서 이미 읽은 행이고(get이
    // LIST_INCLUDE로 가져오므로 코드 라벨까지 들어 있다), after는 갱신 결과다.
    // 추가 조회 없이 두 행을 비교한다.
    return this.prisma.client.$transaction(async (tx) => {
      const updated = await tx.patent.update({
        where: { id },
        data,
        include: LIST_INCLUDE,
      });

      await this.audit.recordFieldChanges(tx, {
        patentId: id,
        actorUserId,
        requestId,
        before,
        after: updated,
      });

      return updated;
    });
  }

  async remove(
    id: number,
    actorUserId: string | null = null,
    requestId: string | null = null,
  ) {
    const patent = await this.get(id);

    return this.prisma.client.$transaction(async (tx) => {
      // 삭제 **전에** 남긴다. patent_id는 삭제 시 SetNull되지만 metadata의 출원번호로
      // 어느 건이었는지 읽힌다.
      await this.audit.recordEvent(tx, {
        patentId: id,
        actorUserId,
        requestId,
        eventType: "PATENT_DELETED",
        patent,
      });
      // patent_ipc·admin은 onDelete Cascade라 함께 삭제된다.
      await tx.patent.delete({ where: { id } });
      return { id };
    });
  }

  private async assertApplicationNumberFree(
    applicationNumber: string,
    excludeId?: number,
  ) {
    const existing = await this.prisma.client.patent.findUnique({
      where: { applicationNumber },
      select: { id: true },
    });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException("PATENT_APPLICATION_NUMBER_DUPLICATED");
    }
  }

  private async assertInternalRefFree(
    internalRef: string | null | undefined,
    excludeId?: number,
  ) {
    const trimmed = internalRef?.trim();
    if (!trimmed) return;
    const existing = await this.prisma.client.patent.findUnique({
      where: { internalRef: normalizeInternalRef(trimmed) },
      select: { id: true },
    });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException("PATENT_INTERNAL_REF_DUPLICATED");
    }
  }

  /** FK 위반은 Prisma의 P2003 대신 읽을 수 있는 code로 돌려준다. */
  private async assertReferencesExist(dto: {
    countryId?: number | null;
    attorneyNumber?: number | null;
    legalStatusId?: number | null;
    examStatusId?: number | null;
    target?: string | null;
    applicant?: string | null;
    inventorIds?: number[];
  }) {
    if (dto.countryId != null) {
      const country = await this.prisma.client.country.findUnique({
        where: { id: dto.countryId },
        select: { id: true },
      });
      if (!country) throw new NotFoundException("PATENT_COUNTRY_NOT_FOUND");
    }
    if (dto.attorneyNumber != null) {
      const attorney = await this.prisma.client.attorney.findUnique({
        where: { attorneyNumber: dto.attorneyNumber },
        select: { attorneyNumber: true },
      });
      if (!attorney) throw new NotFoundException("PATENT_ATTORNEY_NOT_FOUND");
    }
    if (dto.legalStatusId != null) {
      const legalStatus = await this.prisma.client.legalStatus.findUnique({
        where: { id: dto.legalStatusId },
        select: { id: true },
      });
      if (!legalStatus) {
        throw new NotFoundException("PATENT_LEGAL_STATUS_NOT_FOUND");
      }
    }
    if (dto.examStatusId != null) {
      const examStatus = await this.prisma.client.examStatus.findUnique({
        where: { id: dto.examStatusId },
        select: { id: true },
      });
      if (!examStatus) {
        throw new NotFoundException("PATENT_EXAM_STATUS_NOT_FOUND");
      }
    }
    const target = toTrimmedText(dto.target);
    if (target) {
      const foundTarget = await this.prisma.client.patentTarget.findUnique({
        where: { target },
        select: { id: true },
      });
      if (!foundTarget) {
        throw new NotFoundException("PATENT_TARGET_NOT_FOUND");
      }
    }
    const applicant = toTrimmedText(dto.applicant);
    if (applicant) {
      const foundApplicant = await this.prisma.client.patentApplicant.findUnique({
        where: { applicant },
        select: { id: true },
      });
      if (!foundApplicant) {
        throw new NotFoundException("PATENT_APPLICANT_NOT_FOUND");
      }
    }
    if (dto.inventorIds?.length) {
      const inventorIds = [...new Set(dto.inventorIds)];
      const foundInventors = await this.prisma.client.patentInventor.count({
        where: { id: { in: inventorIds } },
      });
      if (foundInventors !== inventorIds.length) {
        throw new NotFoundException("PATENT_INVENTOR_NOT_FOUND");
      }
    }
  }
}

const pick = <T extends object, K extends keyof T>(source: T, key: K) =>
  (key in source && source[key] !== undefined ? { [key]: source[key] } : {}) as
    Record<never, never> | Pick<T, K>;

const pickDate = <T extends object, K extends keyof T>(source: T, key: K) => {
  if (!(key in source) || source[key] === undefined) return {};
  const value = source[key] as string | null;
  return { [key]: value === null ? null : new Date(value) };
};

const toTrimmedText = (
  value: string | null | undefined,
): string | null | undefined => {
  if (value === undefined || value === null) return value;
  return value.trim() || null;
};
