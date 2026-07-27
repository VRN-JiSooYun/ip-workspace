import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { basename } from 'node:path';
import type {
  ConferenceExcelInspection,
  ConferenceExcelProfile,
  ConferenceExcelRow,
  ConferenceExcelSource,
  ConferenceImportIssueDraft,
} from './conference-import.types';

const PARTICIPATION_COLUMNS = new Set([
  'num_bookmarked',
  'num_comment',
  'list_dict_comment',
  'bookmark_conference',
  'bookmark_abstract',
]);

const cellText = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    const item = value as {
      text?: unknown;
      result?: unknown;
      richText?: Array<{ text?: unknown }>;
    };
    if (item.text !== undefined) return String(item.text).trim();
    if (item.result !== undefined) return cellText(item.result);
    if (Array.isArray(item.richText)) {
      return item.richText.map((part) => String(part.text ?? '')).join('').trim();
    }
  }
  return String(value).trim();
};

export const parseConferenceExcelSource = (
  filename: string,
): ConferenceExcelSource | null => {
  const legacy = /^Exported_(.+)_Abstract_\(\d{4}-\d{2}-\d{2}\)\.xlsx$/i.exec(filename);
  if (legacy) return { sourceFile: filename, conferenceKey: legacy[1], profile: 'LEGACY_EXPORT' };

  const metadata = /^(.+)_abstract_(detail_all|poster|document|video)\.xlsx$/i.exec(filename);
  if (!metadata) return null;
  return {
    sourceFile: filename,
    conferenceKey: metadata[1],
    profile: metadata[2].toUpperCase() === 'DETAIL_ALL'
      ? 'DETAIL'
      : metadata[2].toUpperCase() as ConferenceExcelProfile,
  };
};

const requiredHeaders = (profile: ConferenceExcelProfile): string[][] => {
  if (profile === 'LEGACY_EXPORT') return [['id'], ['title'], ['url']];
  if (profile === 'DETAIL') return [['abstract_url'], ['title']];
  return [['abstract_url'], [`${profile.toLowerCase()}_url`]];
};

@Injectable()
export class ConferenceExcelReaderService {
  async inspect(filePath: string): Promise<ConferenceExcelInspection> {
    const sourceFile = basename(filePath);
    const parsed = parseConferenceExcelSource(sourceFile);
    if (!parsed) {
      return {
        sourceFile,
        conferenceKey: '',
        profile: 'DETAIL',
        headers: [],
        rowCount: 0,
        skippedParticipationColumns: [],
        issues: [{
          sourceFile,
          rowNumber: null,
          entityType: 'FILE',
          severity: 'ERROR',
          errorCode: 'UNSUPPORTED_FILENAME',
          message: 'Excel filename does not match a supported Conference import profile.',
        }],
      };
    }

    const issues: ConferenceImportIssueDraft[] = [];
    const workbook = new ExcelJS.stream.xlsx.WorkbookReader(filePath, {
      entries: 'emit',
      sharedStrings: 'cache',
      hyperlinks: 'ignore',
      styles: 'ignore',
      worksheets: 'emit',
    });
    let headers: string[] = [];
    let rowCount = 0;
    let worksheetCount = 0;
    const seenKeys = new Set<string>();

    for await (const worksheet of workbook) {
      worksheetCount += 1;
      if (worksheetCount > 1) {
        issues.push({
          sourceFile,
          rowNumber: null,
          entityType: 'FILE',
          severity: 'WARNING',
          errorCode: 'ADDITIONAL_SHEET_IGNORED',
          message: 'Only the first worksheet is imported.',
        });
        break;
      }

      for await (const row of worksheet) {
        const values = Array.isArray(row.values)
          ? (row.values as unknown[]).slice(1).map(cellText)
          : [];
        if (headers.length === 0) {
          headers = values.map((value) => value.trim().toLowerCase());
          continue;
        }
        if (values.every((value) => value === '')) continue;
        rowCount += 1;
        const rowNumber = Number(row.number);
        const keyHeader = parsed.profile === 'LEGACY_EXPORT' ? 'id' : 'abstract_url';
        const keyIndex = headers.indexOf(keyHeader);
        const key = keyIndex >= 0 ? values[keyIndex] ?? '' : '';
        if (!key) {
          issues.push({
            sourceFile,
            rowNumber,
            entityType: 'ABSTRACT',
            severity: 'ERROR',
            errorCode: 'IMPORT_KEY_MISSING',
            message: `${keyHeader} is required.`,
          });
        } else if (seenKeys.has(key)) {
          issues.push({
            sourceFile,
            rowNumber,
            entityType: 'ABSTRACT',
            severity: 'ERROR',
            errorCode: 'DUPLICATE_IMPORT_KEY',
            message: `Duplicate ${keyHeader} in the same file.`,
            sourceSnapshot: { key },
          });
        } else {
          seenKeys.add(key);
        }
      }
    }

    const isExpectedEmptyPlaceholder = (
      parsed.conferenceKey === 'ESMO_2026' && rowCount === 0
    );
    if (!isExpectedEmptyPlaceholder) {
      for (const alternatives of requiredHeaders(parsed.profile)) {
        if (!alternatives.some((header) => headers.includes(header))) {
          issues.push({
            sourceFile,
            rowNumber: 1,
            entityType: 'HEADER',
            severity: 'ERROR',
            errorCode: 'REQUIRED_HEADER_MISSING',
            message: `Required header is missing: ${alternatives.join(' or ')}`,
          });
        }
      }
    }
    if (rowCount === 0) {
      issues.push({
        sourceFile,
        rowNumber: null,
        entityType: 'FILE',
        severity: isExpectedEmptyPlaceholder ? 'WARNING' : 'ERROR',
        errorCode: isExpectedEmptyPlaceholder ? 'EMPTY_EXPECTED' : 'EMPTY_FILE',
        message: isExpectedEmptyPlaceholder
          ? 'ESMO_2026 is an expected unopened placeholder.'
          : 'Excel file has no data rows.',
      });
    }

    return {
      sourceFile,
      conferenceKey: parsed.conferenceKey,
      profile: parsed.profile,
      headers,
      rowCount,
      skippedParticipationColumns: headers.filter((header) => PARTICIPATION_COLUMNS.has(header)),
      issues,
    };
  }

  async *rows(filePath: string): AsyncGenerator<ConferenceExcelRow> {
    const workbook = new ExcelJS.stream.xlsx.WorkbookReader(filePath, {
      entries: 'emit',
      sharedStrings: 'cache',
      hyperlinks: 'ignore',
      styles: 'ignore',
      worksheets: 'emit',
    });
    let worksheetCount = 0;
    let headers: string[] = [];

    for await (const worksheet of workbook) {
      worksheetCount += 1;
      if (worksheetCount > 1) break;
      for await (const row of worksheet) {
        const cells = Array.isArray(row.values)
          ? (row.values as unknown[]).slice(1).map(cellText)
          : [];
        if (headers.length === 0) {
          headers = cells.map((value) => value.trim().toLowerCase());
          continue;
        }
        if (cells.every((value) => value === '')) continue;
        const values: Record<string, string> = {};
        headers.forEach((header, index) => {
          if (header) values[header] = cells[index] ?? '';
        });
        yield { rowNumber: Number(row.number), values };
      }
    }
  }
}
