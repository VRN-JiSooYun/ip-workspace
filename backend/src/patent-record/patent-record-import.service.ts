import { BadRequestException, Injectable, Logger } from "@nestjs/common";
// 이 프로젝트는 @prisma/client가 아니라 generator output(src/generated/prisma)을 쓴다.
import type { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../database/prisma.service";
import { buildInternalRefColumns, normalizeInternalRef } from "./internal-ref";
import { auditedFieldNames } from "./patent-audit-fields";
import {
  PATENT_CSV_COLUMNS,
  parseCsv,
  parseCsvBoolean,
  parseCsvDate,
  resolveHeaderField,
  type PatentCsvField,
} from "./patent-csv";
import { mergeSheetNotes } from "./rich-text";

export type ImportMode = "DRY_RUN" | "APPLY";
export type DuplicateMode = "SKIP" | "UPDATE";

export type ImportIssue = {
  rowNumber: number | null;
  severity: "ERROR" | "WARNING";
  errorCode: string;
  message: string;
  applicationNumber: string | null;
};

export type ImportResult = {
  mode: ImportMode;
  duplicateMode: DuplicateMode;
  sourceCount: number;
  insertCount: number;
  updateCount: number;
  skipCount: number;
  errorCount: number;
  /** 인식하지 못해 무시한 CSV 헤더. */
  ignoredHeaders: string[];
  /** APPLY 때 새로 만들어질 코드. 대리인은 자동 생성하지 않는다. */
  newCodes: {
    countries: string[];
    legalStatuses: string[];
    examStatuses: string[];
    targets: string[];
  };
  issues: ImportIssue[];
};

/** 한 행에서 뽑아낸, DB에 넣기 직전 상태의 값. */
type Candidate = {
  rowNumber: number;
  applicationNumber: string;
  internalRef: string | null;
  country: string;
  legalStatus: string | null;
  examStatus: string | null;
  attorneyNumber: number | null;
  attorneyName: string | null;
  data: {
    koreanTitle: string | null;
    englishTitle: string | null;
    applicationDate: Date | null;
    applicant: string | null;
    registrationNumber: string | null;
    registrationDate: string | null;
    publicationNumber: string | null;
    publicationDate: Date | null;
    intApplicationNumber: string | null;
    intApplicationDate: Date | null;
    intPublicationNumber: string | null;
    intPublicationDate: Date | null;
    parentApplicationNumber: string | null;
    target: string | null;
    inventors: string | null;
    todoDueDate: Date | null;
    relationType: string | null;
    licenseAgreement: string | null;
    rightsChange: string | null;
    shareAgreement: string | null;
    expectedExpiryDate: Date | null;
    note: string | null;
    exam: boolean | null;
    examDate: Date | null;
  };
};

const MAX_ROWS = 5000;

const textOrNull = (value: string | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const normalizeCode = (value: string): string => value.trim().toLowerCase();

@Injectable()
export class PatentRecordImportService {
  private readonly logger = new Logger(PatentRecordImportService.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(
    csv: string,
    mode: ImportMode,
    duplicateMode: DuplicateMode,
  ): Promise<ImportResult> {
    const rows = parseCsv(csv);
    if (rows.length === 0) throw new BadRequestException("PATENT_CSV_EMPTY");

    const [headerRow, ...dataRows] = rows;
    if (dataRows.length > MAX_ROWS) {
      throw new BadRequestException(`PATENT_CSV_TOO_MANY_ROWS:${MAX_ROWS}`);
    }

    const { fieldByIndex, ignoredHeaders } = this.mapHeaders(headerRow);
    if (!Object.values(fieldByIndex).includes("applicationNumber")) {
      throw new BadRequestException(
        "PATENT_CSV_APPLICATION_NUMBER_COLUMN_MISSING",
      );
    }
    if (!Object.values(fieldByIndex).includes("country")) {
      throw new BadRequestException("PATENT_CSV_COUNTRY_COLUMN_MISSING");
    }

    const issues: ImportIssue[] = [];
    const candidates: Candidate[] = [];
    const seenApplicationNumbers = new Map<string, number>();
    const seenInternalRefs = new Map<string, number>();

    dataRows.forEach((cells, index) => {
      // 헤더가 1행이므로 사용자가 보는 행 번호는 +2.
      const rowNumber = index + 2;
      const candidate = this.readRow(cells, fieldByIndex, rowNumber, issues);
      if (!candidate) return;

      const duplicateRow = seenApplicationNumbers.get(
        normalizeCode(candidate.applicationNumber),
      );
      if (duplicateRow !== undefined) {
        issues.push({
          rowNumber,
          severity: "ERROR",
          errorCode: "PATENT_CSV_DUPLICATED_IN_FILE",
          message: `파일 안에서 출원번호가 ${duplicateRow}행과 중복됩니다.`,
          applicationNumber: candidate.applicationNumber,
        });
        return;
      }
      seenApplicationNumbers.set(
        normalizeCode(candidate.applicationNumber),
        rowNumber,
      );

      if (candidate.internalRef) {
        const refKey = normalizeInternalRef(candidate.internalRef);
        const duplicateRefRow = seenInternalRefs.get(refKey);
        if (duplicateRefRow !== undefined) {
          issues.push({
            rowNumber,
            severity: "ERROR",
            errorCode: "PATENT_CSV_INTERNAL_REF_DUPLICATED_IN_FILE",
            message: `파일 안에서 내부관리번호가 ${duplicateRefRow}행과 중복됩니다.`,
            applicationNumber: candidate.applicationNumber,
          });
          return;
        }
        seenInternalRefs.set(refKey, rowNumber);
      }

      candidates.push(candidate);
    });

    const resolution = await this.resolveCodes(candidates, issues);
    const existing = await this.findExisting(candidates);
    await this.flagTakenInternalRefs(
      candidates,
      existing,
      issues,
      resolution.failedRows,
    );

    let insertCount = 0;
    let updateCount = 0;
    let skipCount = 0;
    const writable: Array<{ candidate: Candidate; existingId: number | null }> =
      [];

    for (const candidate of candidates) {
      if (resolution.failedRows.has(candidate.rowNumber)) continue;

      const existingId =
        existing.get(normalizeCode(candidate.applicationNumber)) ?? null;
      if (existingId !== null) {
        if (duplicateMode === "SKIP") {
          skipCount += 1;
          issues.push({
            rowNumber: candidate.rowNumber,
            severity: "WARNING",
            errorCode: "PATENT_CSV_ALREADY_EXISTS",
            message: "이미 등록된 출원번호라 건너뜁니다.",
            applicationNumber: candidate.applicationNumber,
          });
          continue;
        }
        updateCount += 1;
      } else {
        insertCount += 1;
      }
      writable.push({ candidate, existingId });
    }

    const errorCount = issues.filter(
      (issue) => issue.severity === "ERROR",
    ).length;

    const result: ImportResult = {
      mode,
      duplicateMode,
      sourceCount: dataRows.length,
      insertCount,
      updateCount,
      skipCount,
      errorCount,
      ignoredHeaders,
      newCodes: resolution.newCodes,
      issues,
    };

    if (mode === "DRY_RUN") return result;

    await this.apply(writable, resolution);
    this.logger.log(
      `CSV import applied: +${insertCount} ~${updateCount} skip=${skipCount} error=${errorCount}`,
    );
    return result;
  }

  private mapHeaders(headerRow: string[]) {
    const fieldByIndex: Record<number, PatentCsvField> = {};
    const ignoredHeaders: string[] = [];
    headerRow.forEach((header, index) => {
      const trimmed = header.trim();
      if (!trimmed) return;
      const field = resolveHeaderField(trimmed);
      if (field) fieldByIndex[index] = field;
      else ignoredHeaders.push(trimmed);
    });
    return { fieldByIndex, ignoredHeaders };
  }

  private readRow(
    cells: string[],
    fieldByIndex: Record<number, PatentCsvField>,
    rowNumber: number,
    issues: ImportIssue[],
  ): Candidate | null {
    const raw = {} as Record<PatentCsvField, string>;
    for (const [index, field] of Object.entries(fieldByIndex)) {
      raw[field] = cells[Number(index)] ?? "";
    }

    const applicationNumber = textOrNull(raw.applicationNumber);
    if (!applicationNumber) {
      issues.push({
        rowNumber,
        severity: "ERROR",
        errorCode: "PATENT_CSV_APPLICATION_NUMBER_REQUIRED",
        message: "출원번호가 비어 있습니다.",
        applicationNumber: null,
      });
      return null;
    }

    const country = textOrNull(raw.country);
    if (!country) {
      issues.push({
        rowNumber,
        severity: "ERROR",
        errorCode: "PATENT_CSV_COUNTRY_REQUIRED",
        message: "출원국이 비어 있습니다.",
        applicationNumber,
      });
      return null;
    }

    const dateField = (field: PatentCsvField): Date | null | undefined => {
      const value = raw[field];
      if (value === undefined || value.trim() === "") return null;
      const parsed = parseCsvDate(value);
      if (!parsed) {
        issues.push({
          rowNumber,
          severity: "ERROR",
          errorCode: "PATENT_CSV_DATE_INVALID",
          message: `날짜 형식을 읽을 수 없습니다 (${field}: "${value.trim()}"). YYYY-MM-DD 형식을 써주세요.`,
          applicationNumber,
        });
        return undefined;
      }
      return parsed;
    };

    const applicationDate = dateField("applicationDate");
    const publicationDate = dateField("publicationDate");
    const intApplicationDate = dateField("intApplicationDate");
    const intPublicationDate = dateField("intPublicationDate");
    const examDate = dateField("examDate");
    const todoDueDate = dateField("todoDueDate");
    const expectedExpiryDate = dateField("expectedExpiryDate");
    if (
      applicationDate === undefined ||
      publicationDate === undefined ||
      intApplicationDate === undefined ||
      intPublicationDate === undefined ||
      examDate === undefined ||
      todoDueDate === undefined ||
      expectedExpiryDate === undefined
    ) {
      return null;
    }

    const exam = parseCsvBoolean(raw.exam ?? "");
    if (exam === undefined) {
      issues.push({
        rowNumber,
        severity: "ERROR",
        errorCode: "PATENT_CSV_BOOLEAN_INVALID",
        message: `심사청구 값을 읽을 수 없습니다 ("${raw.exam?.trim()}"). Y/N으로 써주세요.`,
        applicationNumber,
      });
      return null;
    }

    let attorneyNumber: number | null = null;
    const rawAttorneyNumber = textOrNull(raw.attorneyNumber);
    if (rawAttorneyNumber) {
      const parsed = Number(rawAttorneyNumber);
      if (!Number.isInteger(parsed) || parsed < 1) {
        issues.push({
          rowNumber,
          severity: "ERROR",
          errorCode: "PATENT_CSV_ATTORNEY_NUMBER_INVALID",
          message: `대리인번호가 정수가 아닙니다 ("${rawAttorneyNumber}").`,
          applicationNumber,
        });
        return null;
      }
      attorneyNumber = parsed;
    }

    return {
      rowNumber,
      applicationNumber,
      internalRef: textOrNull(raw.internalRef),
      country,
      legalStatus: textOrNull(raw.legalStatus),
      examStatus: textOrNull(raw.examStatus),
      attorneyNumber,
      attorneyName: textOrNull(raw.attorneyName),
      data: {
        koreanTitle: textOrNull(raw.koreanTitle),
        englishTitle: textOrNull(raw.englishTitle),
        applicationDate,
        applicant: textOrNull(raw.applicant),
        registrationNumber: textOrNull(raw.registrationNumber),
        registrationDate: textOrNull(raw.registrationDate),
        publicationNumber: textOrNull(raw.publicationNumber),
        publicationDate,
        intApplicationNumber: textOrNull(raw.intApplicationNumber),
        intApplicationDate,
        intPublicationNumber: textOrNull(raw.intPublicationNumber),
        intPublicationDate,
        parentApplicationNumber: textOrNull(raw.parentApplicationNumber),
        exam,
        examDate,
        target: textOrNull(raw.target),
        inventors: textOrNull(raw.inventors),
        todoDueDate,
        relationType: textOrNull(raw.relationType),
        licenseAgreement: textOrNull(raw.licenseAgreement),
        rightsChange: textOrNull(raw.rightsChange),
        shareAgreement: textOrNull(raw.shareAgreement),
        expectedExpiryDate,
        note: mergeSheetNotes(raw.note, raw.statusNote),
      },
    };
  }

  /**
   * country·legal_status·exam_status·target은 없으면 APPLY 때 만든다.
   * attorney는 PK가 외부 대리인번호라 임의 생성이 불가능해 오류로 남긴다.
   */
  private async resolveCodes(candidates: Candidate[], issues: ImportIssue[]) {
    const [countries, legalStatuses, examStatuses, attorneys, targets] =
      await Promise.all([
        this.prisma.client.country.findMany(),
        this.prisma.client.legalStatus.findMany(),
        this.prisma.client.examStatus.findMany(),
        this.prisma.client.attorney.findMany(),
        this.prisma.client.patentTarget.findMany(),
      ]);

    const countryIds = new Map(
      countries.map((row) => [normalizeCode(row.country), row.id]),
    );
    const legalStatusIds = new Map(
      legalStatuses.map((row) => [normalizeCode(row.status), row.id]),
    );
    const examStatusIds = new Map(
      examStatuses.map((row) => [normalizeCode(row.status), row.id]),
    );
    const attorneyNumbers = new Set(attorneys.map((row) => row.attorneyNumber));
    const attorneyIdsByName = new Map(
      attorneys
        .filter((row) => row.attorneyName)
        .map((row) => [
          normalizeCode(row.attorneyName as string),
          row.attorneyNumber,
        ]),
    );
    const targetValues = new Map(
      targets.map((row) => [normalizeCode(row.target), row.target]),
    );

    const newCountries = new Map<string, string>();
    const newLegalStatuses = new Map<string, string>();
    const newExamStatuses = new Map<string, string>();
    const newTargets = new Map<string, string>();
    const failedRows = new Set<number>();
    const attorneyByRow = new Map<number, number | null>();
    const targetByRow = new Map<number, string | null>();

    for (const candidate of candidates) {
      const countryKey = normalizeCode(candidate.country);
      if (!countryIds.has(countryKey) && !newCountries.has(countryKey)) {
        newCountries.set(countryKey, candidate.country);
      }

      if (candidate.legalStatus) {
        const key = normalizeCode(candidate.legalStatus);
        if (!legalStatusIds.has(key) && !newLegalStatuses.has(key)) {
          newLegalStatuses.set(key, candidate.legalStatus);
        }
      }
      if (candidate.examStatus) {
        const key = normalizeCode(candidate.examStatus);
        if (!examStatusIds.has(key) && !newExamStatuses.has(key)) {
          newExamStatuses.set(key, candidate.examStatus);
        }
      }
      if (candidate.data.target) {
        const key = normalizeCode(candidate.data.target);
        const resolved = targetValues.get(key) ?? newTargets.get(key);
        if (resolved) {
          targetByRow.set(candidate.rowNumber, resolved);
        } else {
          newTargets.set(key, candidate.data.target);
          targetByRow.set(candidate.rowNumber, candidate.data.target);
        }
      } else {
        targetByRow.set(candidate.rowNumber, null);
      }

      // 대리인은 번호 우선, 없으면 이름으로 찾는다.
      // PK가 외부 대리인번호라 자동 생성할 수 없으므로 못 찾으면 오류 행이다.
      if (candidate.attorneyNumber !== null) {
        if (!attorneyNumbers.has(candidate.attorneyNumber)) {
          issues.push({
            rowNumber: candidate.rowNumber,
            severity: "ERROR",
            errorCode: "PATENT_CSV_ATTORNEY_NOT_FOUND",
            message: `등록되지 않은 대리인번호입니다 (${candidate.attorneyNumber}). 특허 코드 관리에서 먼저 등록해 주세요.`,
            applicationNumber: candidate.applicationNumber,
          });
          failedRows.add(candidate.rowNumber);
          continue;
        }
        attorneyByRow.set(candidate.rowNumber, candidate.attorneyNumber);
      } else if (candidate.attorneyName) {
        const found = attorneyIdsByName.get(
          normalizeCode(candidate.attorneyName),
        );
        if (found === undefined) {
          issues.push({
            rowNumber: candidate.rowNumber,
            severity: "ERROR",
            errorCode: "PATENT_CSV_ATTORNEY_NOT_FOUND",
            message: `등록되지 않은 대리인입니다 ("${candidate.attorneyName}"). 특허 코드 관리에서 먼저 등록해 주세요.`,
            applicationNumber: candidate.applicationNumber,
          });
          failedRows.add(candidate.rowNumber);
          continue;
        }
        attorneyByRow.set(candidate.rowNumber, found);
      } else {
        attorneyByRow.set(candidate.rowNumber, null);
      }
    }

    return {
      countryIds,
      legalStatusIds,
      examStatusIds,
      attorneyIdsByName,
      attorneyByRow,
      targetByRow,
      failedRows,
      newCodes: {
        countries: [...newCountries.values()],
        legalStatuses: [...newLegalStatuses.values()],
        examStatuses: [...newExamStatuses.values()],
        targets: [...newTargets.values()],
      },
    };
  }

  /**
   * 내부관리번호는 unique다. 다른 특허가 이미 쓰고 있으면 APPLY에서 제약 위반이 나므로
   * DRY_RUN 단계에서 해당 행을 오류로 걸러낸다. 같은 특허가 자기 번호를 유지하는 건 정상.
   */
  private async flagTakenInternalRefs(
    candidates: Candidate[],
    existing: Map<string, number>,
    issues: ImportIssue[],
    failedRows: Set<number>,
  ) {
    const refs = candidates
      .map((candidate) => candidate.internalRef)
      .filter((ref): ref is string => Boolean(ref))
      .map((ref) => normalizeInternalRef(ref));
    if (refs.length === 0) return;

    const rows = await this.prisma.client.patent.findMany({
      where: { internalRef: { in: refs } },
      select: { id: true, internalRef: true },
    });
    const ownerByRef = new Map(
      rows.map((row) => [row.internalRef as string, row.id]),
    );

    for (const candidate of candidates) {
      if (!candidate.internalRef) continue;
      const ownerId = ownerByRef.get(
        normalizeInternalRef(candidate.internalRef),
      );
      if (ownerId === undefined) continue;

      const selfId = existing.get(normalizeCode(candidate.applicationNumber));
      if (selfId === ownerId) continue; // 같은 특허가 자기 번호를 유지하는 경우

      issues.push({
        rowNumber: candidate.rowNumber,
        severity: "ERROR",
        errorCode: "PATENT_CSV_INTERNAL_REF_TAKEN",
        message: `내부관리번호 "${candidate.internalRef}"는 다른 특허가 이미 사용 중입니다.`,
        applicationNumber: candidate.applicationNumber,
      });
      failedRows.add(candidate.rowNumber);
    }
  }

  private async findExisting(candidates: Candidate[]) {
    if (candidates.length === 0) return new Map<string, number>();
    const rows = await this.prisma.client.patent.findMany({
      where: {
        applicationNumber: {
          in: candidates.map((candidate) => candidate.applicationNumber),
        },
      },
      select: { id: true, applicationNumber: true },
    });
    return new Map(
      rows.map((row) => [normalizeCode(row.applicationNumber), row.id]),
    );
  }

  private async apply(
    writable: Array<{ candidate: Candidate; existingId: number | null }>,
    resolution: Awaited<ReturnType<PatentRecordImportService["resolveCodes"]>>,
  ) {
    if (writable.length === 0) return;

    await this.prisma.client.$transaction(async (tx) => {
      const countryIds = new Map(resolution.countryIds);
      const legalStatusIds = new Map(resolution.legalStatusIds);
      const examStatusIds = new Map(resolution.examStatusIds);

      for (const value of resolution.newCodes.countries) {
        const created = await tx.country.create({ data: { country: value } });
        countryIds.set(normalizeCode(value), created.id);
      }
      for (const value of resolution.newCodes.legalStatuses) {
        const created = await tx.legalStatus.create({
          data: { status: value },
        });
        legalStatusIds.set(normalizeCode(value), created.id);
      }
      for (const value of resolution.newCodes.examStatuses) {
        const created = await tx.examStatus.create({ data: { status: value } });
        examStatusIds.set(normalizeCode(value), created.id);
      }
      for (const value of resolution.newCodes.targets) {
        await tx.patentTarget.create({ data: { target: value } });
      }

      for (const { candidate, existingId } of writable) {
        const countryId = countryIds.get(normalizeCode(candidate.country));
        if (countryId === undefined) continue; // resolveCodes를 통과했으면 도달하지 않는다.

        const attorneyNumber =
          resolution.attorneyByRow.get(candidate.rowNumber) ?? null;

        const data = {
          ...candidate.data,
          target: resolution.targetByRow.get(candidate.rowNumber) ?? null,
          ...buildInternalRefColumns(candidate.internalRef),
          countryId,
          attorneyNumber,
          legalStatusId: candidate.legalStatus
            ? (legalStatusIds.get(normalizeCode(candidate.legalStatus)) ?? null)
            : null,
          examStatusId: candidate.examStatus
            ? (examStatusIds.get(normalizeCode(candidate.examStatus)) ?? null)
            : null,
        };

        if (existingId !== null) {
          await tx.patent.update({ where: { id: existingId }, data });
          await this.recordImport(tx, existingId, candidate, data);
          await this.syncLegacyTodo(
            tx,
            existingId,
            candidate.data.todoDueDate,
          );
        } else {
          const created = await tx.patent.create({
            data: { ...data, applicationNumber: candidate.applicationNumber },
            select: { id: true },
          });
          await this.recordImport(tx, created.id, candidate, data);
          await this.syncLegacyTodo(
            tx,
            created.id,
            candidate.data.todoDueDate,
          );
        }
      }
    });
  }

  /**
   * 임포트는 특허당 요약 **1행**만 남긴다.
   *
   * 화면 편집은 필드마다 한 행을 남기지만(활동 피드가 그걸로 그려진다) 임포트에 같은 규칙을
   * 쓰면 500건 × 20필드 = 만 단위 행이 한 번에 생긴다. 무엇이 바뀌었는지는 컬럼 **이름**만
   * 담아 두고, 값 단위 비교는 하지 않는다(그러려면 행마다 before를 읽어야 해서 임포트가
   * 느려진다).
   */
  private async recordImport(
    tx: Prisma.TransactionClient,
    patentId: number,
    candidate: { applicationNumber: string; internalRef: string | null },
    data: Record<string, unknown>,
  ): Promise<void> {
    await tx.patentAuditLog.create({
      data: {
        patentId,
        // 임포트를 실행한 사람은 컨트롤러가 알지만, 이 서비스까지 내리지 않았다.
        // 지금은 "임포트로 바뀌었다"만 남긴다(누가 돌렸는지는 auth_audit_log 쪽 일이다).
        actorUserId: null,
        eventType: "PATENT_IMPORTED",
        metadata: {
          applicationNumber: candidate.applicationNumber,
          internalRef: candidate.internalRef,
          changedFields: auditedFieldNames(Object.keys(data)),
        },
      },
    });
  }

  private async syncLegacyTodo(
    tx: Prisma.TransactionClient,
    patentId: number,
    dueDate: Date | null,
  ) {
    const sourceKey = `PATENT_TODO_DUE_DATE:${patentId}`;
    if (!dueDate) {
      await tx.patentTodo.deleteMany({ where: { sourceKey } });
      return;
    }
    await tx.patentTodo.upsert({
      where: { sourceKey },
      create: {
        patentId,
        title: "기존 To-do",
        dueDate,
        sourceKey,
      },
      update: { dueDate },
    });
  }
}

export const PATENT_CSV_HEADERS = PATENT_CSV_COLUMNS.map(
  (column) => column.header,
);
