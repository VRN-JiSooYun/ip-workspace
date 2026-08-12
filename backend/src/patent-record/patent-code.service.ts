import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import type { PatentCodeBodyDto } from "./dto/patent-code.dto";

export const PATENT_CODE_TYPES = [
  "countries",
  "attorneys",
  "legal-statuses",
  "exam-statuses",
  "targets",
] as const;

export type PatentCodeType = (typeof PATENT_CODE_TYPES)[number];

/** 화면이 type을 몰라도 되도록 {id, value, usageCount} 한 가지 모양으로 돌려준다. */
export type PatentCodeItem = {
  id: number;
  value: string;
  usageCount: number;
};

@Injectable()
export class PatentCodeService {
  constructor(private readonly prisma: PrismaService) {}

  async list(type: PatentCodeType): Promise<PatentCodeItem[]> {
    switch (type) {
      case "countries": {
        const rows = await this.prisma.client.country.findMany({
          orderBy: { country: "asc" },
          include: { _count: { select: { patents: true } } },
        });
        return rows.map((row) => ({
          id: row.id,
          value: row.country,
          usageCount: row._count.patents,
        }));
      }
      case "attorneys": {
        const rows = await this.prisma.client.attorney.findMany({
          orderBy: { attorneyNumber: "asc" },
          include: { _count: { select: { patents: true } } },
        });
        return rows.map((row) => ({
          id: row.attorneyNumber,
          value: row.attorneyName ?? "",
          usageCount: row._count.patents,
        }));
      }
      case "legal-statuses": {
        const rows = await this.prisma.client.legalStatus.findMany({
          orderBy: { status: "asc" },
          include: { _count: { select: { patents: true } } },
        });
        return rows.map((row) => ({
          id: row.id,
          value: row.status,
          usageCount: row._count.patents,
        }));
      }
      case "exam-statuses": {
        const rows = await this.prisma.client.examStatus.findMany({
          orderBy: { status: "asc" },
          include: { _count: { select: { patents: true } } },
        });
        return rows.map((row) => ({
          id: row.id,
          value: row.status,
          usageCount: row._count.patents,
        }));
      }
      case "targets": {
        const rows = await this.prisma.client.patentTarget.findMany({
          orderBy: { target: "asc" },
          include: { _count: { select: { patents: true } } },
        });
        return rows.map((row) => ({
          id: row.id,
          value: row.target,
          usageCount: row._count.patents,
        }));
      }
    }
  }

  async create(
    type: PatentCodeType,
    body: PatentCodeBodyDto,
  ): Promise<PatentCodeItem> {
    const value = body.value.trim();
    if (!value) throw new BadRequestException("PATENT_CODE_VALUE_REQUIRED");

    switch (type) {
      case "countries": {
        await this.assertCountryNameFree(value);
        const row = await this.prisma.client.country.create({
          data: { country: value },
        });
        return { id: row.id, value: row.country, usageCount: 0 };
      }
      case "attorneys": {
        // attorney만 PK를 직접 받는다. autoincrement가 아니라 비워둘 수 없다.
        if (body.id === undefined) {
          throw new BadRequestException("PATENT_ATTORNEY_NUMBER_REQUIRED");
        }
        const existing = await this.prisma.client.attorney.findUnique({
          where: { attorneyNumber: body.id },
          select: { attorneyNumber: true },
        });
        if (existing) {
          throw new ConflictException("PATENT_ATTORNEY_NUMBER_DUPLICATED");
        }
        const row = await this.prisma.client.attorney.create({
          data: { attorneyNumber: body.id, attorneyName: value },
        });
        return {
          id: row.attorneyNumber,
          value: row.attorneyName ?? "",
          usageCount: 0,
        };
      }
      case "legal-statuses": {
        const row = await this.prisma.client.legalStatus.create({
          data: { status: value },
        });
        return { id: row.id, value: row.status, usageCount: 0 };
      }
      case "exam-statuses": {
        const row = await this.prisma.client.examStatus.create({
          data: { status: value },
        });
        return { id: row.id, value: row.status, usageCount: 0 };
      }
      case "targets": {
        await this.assertTargetNameFree(value);
        const row = await this.prisma.client.patentTarget.create({
          data: { target: value },
        });
        return { id: row.id, value: row.target, usageCount: 0 };
      }
    }
  }

  async update(
    type: PatentCodeType,
    id: number,
    body: PatentCodeBodyDto,
  ): Promise<PatentCodeItem> {
    const value = body.value.trim();
    if (!value) throw new BadRequestException("PATENT_CODE_VALUE_REQUIRED");
    await this.assertExists(type, id);

    switch (type) {
      case "countries": {
        await this.assertCountryNameFree(value, id);
        const row = await this.prisma.client.country.update({
          where: { id },
          data: { country: value },
          include: { _count: { select: { patents: true } } },
        });
        return {
          id: row.id,
          value: row.country,
          usageCount: row._count.patents,
        };
      }
      case "attorneys": {
        const row = await this.prisma.client.attorney.update({
          where: { attorneyNumber: id },
          data: { attorneyName: value },
          include: { _count: { select: { patents: true } } },
        });
        return {
          id: row.attorneyNumber,
          value: row.attorneyName ?? "",
          usageCount: row._count.patents,
        };
      }
      case "legal-statuses": {
        const row = await this.prisma.client.legalStatus.update({
          where: { id },
          data: { status: value },
          include: { _count: { select: { patents: true } } },
        });
        return {
          id: row.id,
          value: row.status,
          usageCount: row._count.patents,
        };
      }
      case "exam-statuses": {
        const row = await this.prisma.client.examStatus.update({
          where: { id },
          data: { status: value },
          include: { _count: { select: { patents: true } } },
        });
        return {
          id: row.id,
          value: row.status,
          usageCount: row._count.patents,
        };
      }
      case "targets": {
        await this.assertTargetNameFree(value, id);
        const row = await this.prisma.client.patentTarget.update({
          where: { id },
          data: { target: value },
          include: { _count: { select: { patents: true } } },
        });
        return {
          id: row.id,
          value: row.target,
          usageCount: row._count.patents,
        };
      }
    }
  }

  /**
   * 사용 중인 코드는 지우지 않는다.
   * schema상 country는 Restrict라 어차피 막히지만, 나머지 셋은 SetNull이라
   * 그대로 두면 특허 수백 건의 값이 조용히 비워진다. 모든 종류를 동일하게 막는다.
   */
  async remove(type: PatentCodeType, id: number): Promise<{ id: number }> {
    await this.assertExists(type, id);
    const usageCount = await this.countUsage(type, id);
    if (usageCount > 0) {
      throw new ConflictException(`PATENT_CODE_IN_USE:${usageCount}`);
    }

    switch (type) {
      case "countries":
        await this.prisma.client.country.delete({ where: { id } });
        break;
      case "attorneys":
        await this.prisma.client.attorney.delete({
          where: { attorneyNumber: id },
        });
        break;
      case "legal-statuses":
        await this.prisma.client.legalStatus.delete({ where: { id } });
        break;
      case "exam-statuses":
        await this.prisma.client.examStatus.delete({ where: { id } });
        break;
      case "targets":
        await this.prisma.client.patentTarget.delete({ where: { id } });
        break;
    }
    return { id };
  }

  private async countUsage(type: PatentCodeType, id: number): Promise<number> {
    switch (type) {
      case "countries":
        return this.prisma.client.patent.count({ where: { countryId: id } });
      case "attorneys":
        return this.prisma.client.patent.count({
          where: { attorneyNumber: id },
        });
      case "legal-statuses":
        return this.prisma.client.patent.count({
          where: { legalStatusId: id },
        });
      case "exam-statuses":
        return this.prisma.client.patent.count({ where: { examStatusId: id } });
      case "targets": {
        const row = await this.prisma.client.patentTarget.findUnique({
          where: { id },
          select: { _count: { select: { patents: true } } },
        });
        return row?._count.patents ?? 0;
      }
    }
  }

  private async assertExists(type: PatentCodeType, id: number): Promise<void> {
    const found = await (async () => {
      switch (type) {
        case "countries":
          return this.prisma.client.country.findUnique({
            where: { id },
            select: { id: true },
          });
        case "attorneys":
          return this.prisma.client.attorney.findUnique({
            where: { attorneyNumber: id },
            select: { attorneyNumber: true },
          });
        case "legal-statuses":
          return this.prisma.client.legalStatus.findUnique({
            where: { id },
            select: { id: true },
          });
        case "exam-statuses":
          return this.prisma.client.examStatus.findUnique({
            where: { id },
            select: { id: true },
          });
        case "targets":
          return this.prisma.client.patentTarget.findUnique({
            where: { id },
            select: { id: true },
          });
      }
    })();
    if (!found) throw new NotFoundException("PATENT_CODE_NOT_FOUND");
  }

  private async assertCountryNameFree(country: string, excludeId?: number) {
    const existing = await this.prisma.client.country.findUnique({
      where: { country },
      select: { id: true },
    });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException("PATENT_COUNTRY_DUPLICATED");
    }
  }

  private async assertTargetNameFree(target: string, excludeId?: number) {
    const existing = await this.prisma.client.patentTarget.findUnique({
      where: { target },
      select: { id: true },
    });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException("PATENT_TARGET_DUPLICATED");
    }
  }
}
