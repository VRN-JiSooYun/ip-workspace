import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { buildInternalRefColumns, normalizeInternalRef } from "./internal-ref";
import type { CreatePatentRecordDto } from "./dto/create-patent-record.dto";
import type { PatentRecordListQueryDto } from "./dto/patent-record-list-query.dto";
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

@Injectable()
export class PatentRecordService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: PatentRecordListQueryDto) {
    const q = query.q?.trim();
    const where = {
      ...(query.countryId ? { countryId: query.countryId } : {}),
      ...(query.legalStatusId ? { legalStatusId: query.legalStatusId } : {}),
      ...(query.examStatusId ? { examStatusId: query.examStatusId } : {}),
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
    const [countries, attorneys, legalStatuses, examStatuses] =
      await Promise.all([
        this.prisma.client.country.findMany({ orderBy: { country: "asc" } }),
        this.prisma.client.attorney.findMany({
          orderBy: { attorneyNumber: "asc" },
        }),
        this.prisma.client.legalStatus.findMany({ orderBy: { status: "asc" } }),
        this.prisma.client.examStatus.findMany({ orderBy: { status: "asc" } }),
      ]);
    return { countries, attorneys, legalStatuses, examStatuses };
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
