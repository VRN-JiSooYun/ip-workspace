import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { buildInternalRefColumns, normalizeInternalRef } from "./internal-ref";
import type { CreatePatentRecordDto } from "./dto/create-patent-record.dto";
import type { PatentRecordListQueryDto } from "./dto/patent-record-list-query.dto";
import type { PatentScheduleQueryDto } from "./dto/patent-schedule-query.dto";
import type { UpdatePatentRecordDto } from "./dto/update-patent-record.dto";

const LIST_INCLUDE = {
  country: { select: { id: true, country: true } },
  attorney: { select: { attorneyNumber: true, attorneyName: true } },
  legalStatus: { select: { id: true, status: true } },
  examStatus: { select: { id: true, status: true } },
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

@Injectable()
export class PatentRecordService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: PatentRecordListQueryDto) {
    const q = query.q?.trim();
    const targets = query.targets
      ?.map((target) => target.trim())
      .filter((target) => target.length > 0);
    const where = {
      ...(query.countryId ? { countryId: query.countryId } : {}),
      ...(query.legalStatusId ? { legalStatusId: query.legalStatusId } : {}),
      ...(query.examStatusId ? { examStatusId: query.examStatusId } : {}),
      ...(targets?.length ? { target: { in: targets } } : {}),
      ...(q
        ? {
            OR: [
              { internalRef: { contains: q, mode: "insensitive" as const } },
              {
                applicationNumber: {
                  contains: q,
                  mode: "insensitive" as const,
                },
              },
              { koreanTitle: { contains: q, mode: "insensitive" as const } },
              { englishTitle: { contains: q, mode: "insensitive" as const } },
              { applicant: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

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

    return { items, total, page: query.page, pageSize: query.pageSize };
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
    const [countries, attorneys, legalStatuses, examStatuses, targets] =
      await Promise.all([
        this.prisma.client.country.findMany({ orderBy: { country: "asc" } }),
        this.prisma.client.attorney.findMany({
          orderBy: { attorneyNumber: "asc" },
        }),
        this.prisma.client.legalStatus.findMany({ orderBy: { status: "asc" } }),
        this.prisma.client.examStatus.findMany({ orderBy: { status: "asc" } }),
        this.prisma.client.patentTarget.findMany({
          orderBy: { target: "asc" },
        }),
      ]);
    return { countries, attorneys, legalStatuses, examStatuses, targets };
  }

  async create(dto: CreatePatentRecordDto) {
    await this.assertReferencesExist(dto);
    await this.assertApplicationNumberFree(dto.applicationNumber);
    await this.assertInternalRefFree(dto.internalRef);

    return this.prisma.client.patent.create({
      data: {
        countryId: dto.countryId,
        applicationNumber: dto.applicationNumber,
        ...buildInternalRefColumns(dto.internalRef),
        koreanTitle: dto.koreanTitle ?? null,
        englishTitle: dto.englishTitle ?? null,
        applicationDate: toDate(dto.applicationDate) ?? null,
        applicant: dto.applicant ?? null,
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
  }

  async update(id: number, dto: UpdatePatentRecordDto) {
    await this.get(id);
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
      ...pick(dto, "applicant"),
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
    };

    return this.prisma.client.patent.update({
      where: { id },
      data,
      include: LIST_INCLUDE,
    });
  }

  async remove(id: number) {
    await this.get(id);
    // patent_ipc·admin은 onDelete Cascade라 함께 삭제된다.
    await this.prisma.client.patent.delete({ where: { id } });
    return { id };
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
