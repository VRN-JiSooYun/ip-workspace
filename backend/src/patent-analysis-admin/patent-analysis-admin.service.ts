import {
  BadGatewayException,
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import ExcelJS from 'exceljs';
import { PrismaService } from '../database/prisma.service';
import { PatentAnalysisHelperClient } from '../patent-analysis/patent-analysis-helper.client';
import type { PatentListResult } from '../patent-analysis/types/patent-analysis-helper.types';
import {
  AdminPatentListQueryDto,
  CreateBioactivityRequestDto,
  CreatePatentTargetRequestDto,
  ModifyAdminPatentDto,
  PatentTargetDecisionDto,
  PatentTargetListQueryDto,
} from './dto/patent-analysis-admin.dto';
import { PatentMemberService } from '../patent-analysis/patent-member.service';

type UploadFile = { buffer: Buffer; originalname: string; mimetype: string };
type TargetRow = Record<string, unknown>;
type TargetListResult = {
  rows?: unknown[];
  selected_rows?: unknown[];
  user_to_alarm?: unknown[] | Record<string, unknown>;
};

type PatentNotificationTarget = {
  targetName: string;
  keywords: string[];
  pending: boolean;
};

type PatentNotificationPreferences = {
  enabled: boolean;
  availableTargets: PatentNotificationTarget[];
  selectedTargets: PatentNotificationTarget[];
};

const totalCount = (value: unknown): number => {
  if (typeof value === 'number') return value;
  if (Array.isArray(value)) return totalCount((value[0] as { total?: unknown })?.total);
  return Number(value) || 0;
};

const canonicalStatus = (value: unknown) => {
  const key = String(value ?? '').trim().toLowerCase().replace(/_/g, ' ');
  if (key === 'request') return 'REQUESTED';
  if (key === 'analysis') return 'ANALYZING';
  if (key === 'bioactivity fail') return 'BIOACTIVITY_FAILED';
  if (key === 'no compound') return 'NO_COMPOUND';
  if (key === 'complete') return 'COMPLETED';
  if (key === 'modified complete') return 'MODIFIED_COMPLETED';
  if (key === 'error') return 'ERROR';
  return 'UNKNOWN';
};

const normalizeStatusValue = (value: unknown) =>
  String(value ?? '').trim().toLowerCase().replace(/_/g, ' ');

const normalizeStringList = (value: unknown): string[] => {
  const result: string[] = [];
  const visit = (current: unknown) => {
    if (Array.isArray(current)) {
      current.forEach(visit);
      return;
    }
    if (typeof current !== 'string') return;
    current.split(',').forEach((item) => {
      const normalized = item.trim();
      if (normalized) result.push(normalized);
    });
  };
  visit(value);
  return [...new Set(result)];
};

const normalizeHelperDate = (value: unknown): string | null => {
  if (typeof value !== 'string' || !value.trim()) return null;
  const normalized = value.trim();
  if (/^\d{4}-\d{2}-\d{2}(?:[T\s].*)?$/.test(normalized)) return normalized;
  const timestamp = Date.parse(normalized);
  return Number.isNaN(timestamp) ? normalized : new Date(timestamp).toISOString();
};

const normalizeMemberId = (value: unknown): number | null => {
  const memberId = Number(value);
  return Number.isInteger(memberId) && memberId > 0 ? memberId : null;
};

const normalizeBoolean = (value: unknown): boolean => {
  if (value === true || value === 1) return true;
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized === 'true' || normalized === '1';
};

const normalizeTargetName = (row: TargetRow): string =>
  String(row.target_name ?? row.targetName ?? '').trim();

const targetKey = (memberId: number, targetName: string) =>
  Buffer.from(JSON.stringify({ memberId, targetName })).toString('base64url');

@Injectable()
export class PatentAnalysisAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly helper: PatentAnalysisHelperClient,
    private readonly members: PatentMemberService,
  ) {}

  async createBioactivityRequest(
    userId: string,
    publicationNumber: string,
    body: CreateBioactivityRequestDto,
  ) {
    const member = await this.members.resolve(userId);
    this.assertPublicationNumber(publicationNumber);
    return this.helper.call({
      operation: 'REQUEST-MODIFY-ALL-BIOACTIVITY',
      actionType: 'REQUEST-MODIFY-ALL-BIOACTIVITY',
      publication_number: publicationNumber,
      owner_id: member.memberId,
      quality: body.quality,
    });
  }

  async createTargetRequest(userId: string, body: CreatePatentTargetRequestDto) {
    const member = await this.members.resolve(userId);
    const targetName = body.targetName.trim();
    if (!targetName) throw new BadRequestException('targetName is required');
    this.assertSafeTargetValue(targetName);
    await this.helper.call({
      operation: 'ADD-NEW-TARGET',
      actionType: 'ADD-NEW-TARGET',
      origin_target_name: targetName,
      owner_id: member.memberId,
      email: member.email,
    });
    return this.getCanonicalNotificationPreferences(member.memberId);
  }

  async getNotificationPreferences(userId: string) {
    const member = await this.members.resolve(userId);
    const result = await this.getTargetList(member.memberId);
    return this.normalizeNotificationPreferences(result);
  }

  async updateNotificationPreference(userId: string, enabled: boolean) {
    const member = await this.members.resolve(userId);
    await this.helper.call({
      operation: enabled ? 'ENABLE-EMAIL-ALARM' : 'DISABLE-EMAIL-ALARM',
      actionType: enabled ? 'ENABLE-EMAIL-ALARM' : 'DISABLE-EMAIL-ALARM',
      owner_id: member.memberId,
      email: enabled ? member.email : undefined,
    });
    return this.getCanonicalNotificationPreferences(member.memberId);
  }

  async addNotificationTarget(userId: string, targetNameValue: string) {
    const member = await this.members.resolve(userId);
    const targetName = this.validateNotificationTargetName(targetNameValue);
    const current = await this.getTargetList(member.memberId);
    const preferences = this.normalizeNotificationPreferences(current);
    const selected = this.findTarget(preferences.selectedTargets, targetName);
    if (selected) return preferences;

    const active = this.findTarget(preferences.availableTargets, targetName);
    if (!active) {
      throw new BadRequestException('PATENT_NOTIFICATION_TARGET_NOT_ACTIVE');
    }
    await this.helper.call({
      operation: 'ADD-TARGET-USER',
      actionType: 'ADD-TARGET-USER',
      owner_id: member.memberId,
      target_name: active.targetName,
      email: member.email,
    });
    return this.getCanonicalNotificationPreferences(member.memberId);
  }

  async removeNotificationTarget(userId: string, targetNameValue: string) {
    const member = await this.members.resolve(userId);
    const targetName = this.validateNotificationTargetName(targetNameValue);
    const current = await this.getTargetList(member.memberId);
    const preferences = this.normalizeNotificationPreferences(current);
    const selected = this.findTarget(preferences.selectedTargets, targetName);
    if (!selected) return preferences;

    await this.helper.call({
      operation: 'REMOVE-TARGET-USER',
      actionType: 'REMOVE-TARGET-USER',
      owner_id: member.memberId,
      target_name: selected.targetName,
    });
    return this.getCanonicalNotificationPreferences(member.memberId);
  }

  async listPatents(adminUserId: string, query: AdminPatentListQueryDto) {
    const member = await this.members.resolve(adminUserId);
    const filters: Record<string, string>[] = [];
    if (query.keyword?.trim()) {
      filters.push({
        filter_column: 'str#p.publication_number',
        filter_condition: "%s ilike '%%%s%%'",
        filter_value: query.keyword.trim().replace(/'/g, "''"),
        filter_conjunction: 'and',
        filter_group_condition: '',
      });
    }
    const requestedStatus = normalizeStatusValue(
      query.requestOnly ? 'request' : query.status,
    );
    if (requestedStatus) {
      filters.push({
        filter_column: "str#replace(status, '_', ' ')",
        filter_condition: "%s ilike '%s'",
        filter_value: requestedStatus.replace(/'/g, "''"),
        filter_conjunction: 'and',
        filter_group_condition: '',
      });
    }
    const result = await this.helper.call<PatentListResult>({
      operation: 'GET-PATENT-LIST',
      actionType: 'GET-PATENT-LIST',
      owner_id: member.memberId,
      filter_conjunction: 'and',
      filter_dict: JSON.stringify(filters.length ? { group_1: filters } : {}),
      filter_group_conjunction_list: '[]',
      order_dict: JSON.stringify([{ column_name: `p.${query.sortField}`, order: query.sortOrder }]),
      'num-rows-per-page': query.pageSize,
      'page-no': query.page,
      whose: 'my',
      folder_id: '',
    });
    const items = (result.partial_rows ?? []) as Record<string, unknown>[];
    const requesterMemberIds = [
      ...new Set(
        items
          .map((row) => normalizeMemberId(row.request_member_id))
          .filter((memberId): memberId is number => memberId !== null),
      ),
    ];
    const requesters = requesterMemberIds.length > 0
      ? await this.prisma.client.notificationRecipient.findMany({
        where: { memberId: { in: requesterMemberIds } },
        select: { id: true, memberId: true, name: true, email: true },
      })
      : [];
    const requestersByMemberId = new Map(
      requesters.map((requester) => [requester.memberId, requester]),
    );

    return {
      items: items.map((row) => {
        const requesterMemberId = normalizeMemberId(row.request_member_id);
        const requester = requesterMemberId === null
          ? undefined
          : requestersByMemberId.get(requesterMemberId);
        return {
          ...row,
          request_member_id: requesterMemberId,
          status: normalizeStatusValue(row.status),
          canonicalStatus: canonicalStatus(row.status),
          target: normalizeStringList(row.target),
          requester: requester
            ? {
              id: requester.id,
              name: requester.name,
              email: requester.email,
              memberId: requester.memberId as number,
            }
            : null,
          requesterUnknown: !requester && (
            requesterMemberId !== null
            || normalizeStatusValue(row.status) === 'request'
          ),
        };
      }),
      totalCount: totalCount(result.total_count ?? result.total_rows),
    };
  }

  async modifyPatent(
    adminUserId: string,
    publicationNumber: string,
    body: ModifyAdminPatentDto,
  ) {
    const member = await this.members.resolve(adminUserId);
    this.assertPublicationNumber(publicationNumber);
    const targets = (body.targets ?? [])
      .map((value) => value.trim())
      .filter(Boolean);
    targets.forEach((value) => this.assertSafeTargetValue(value));
    return this.helper.call({
      operation: 'MODIFY-PATENT-DATA',
      actionType: 'MODIFY-PATENT-DATA',
      owner_id: member.memberId,
      publication_number: publicationNumber,
      publication_date: body.publicationDate ?? '',
      protein_target: targets.join(','),
      applicant: this.escapeHelperSqlText(body.applicant ?? ''),
      status: body.status ?? '',
      comment: this.escapeHelperSqlText(body.comment ?? ''),
    });
  }

  async uploadBioactivity(adminUserId: string, publicationNumber: string, file?: UploadFile) {
    if (!file?.buffer?.length) throw new BadRequestException('BIOACTIVITY_FILE_REQUIRED');
    const member = await this.members.resolve(adminUserId);
    this.assertPublicationNumber(publicationNumber);
    await this.validateBioactivityHeaders(file);
    return this.helper.upload({
      operation: 'UPLOAD-BIOACTIVITY-FILE',
      actionType: 'UPLOAD-BIOACTIVITY-FILE',
      owner_id: member.memberId,
      publication_number: publicationNumber,
    }, file);
  }

  async listTargets(adminUserId: string, query: PatentTargetListQueryDto) {
    const adminMember = await this.members.resolve(adminUserId);
    if (query.status === 'ACTIVE') {
      const result = await this.getTargetList(adminMember.memberId);
      return (result.rows ?? []).map((value) => {
        const row = value as TargetRow;
        return {
          ...row,
          keyword: normalizeStringList(row.keyword),
          date_created: normalizeHelperDate(row.date_created),
          date_updated: normalizeHelperDate(row.date_updated),
        };
      });
    }

    const recipients = await this.prisma.client.notificationRecipient.findMany({
      where: { status: 'ACTIVE', memberId: { not: null } },
      select: { memberId: true, name: true, email: true },
      orderBy: { memberId: 'asc' },
    });
    const recipientsByEmail = new Map(
      recipients.map((recipient) => [recipient.email.trim().toLowerCase(), recipient]),
    );
    const pendingByTargetName = new Map<string, unknown>();
    let failedMemberCount = 0;
    const concurrency = 8;
    for (let index = 0; index < recipients.length; index += concurrency) {
      const batch = recipients.slice(index, index + concurrency);
      const results = await Promise.all(batch.map(async (recipient) => {
        try {
          const result = await this.getTargetList(recipient.memberId as number);
          return { recipient, rows: result.selected_rows ?? [] };
        } catch {
          return { recipient, rows: [], failed: true };
        }
      }));
      results.forEach(({ recipient, rows, failed }) => {
        if (failed) {
          failedMemberCount += 1;
          return;
        }
        (rows as TargetRow[])
          .filter((row) => row.pending === true)
          .forEach((row) => {
            const targetName = String(row.target_name ?? '');
            if (!targetName || pendingByTargetName.has(targetName)) return;
            const rowEmail = String(row.email ?? '').trim();
            const requester = recipientsByEmail.get(rowEmail.toLowerCase()) ?? recipient;
            pendingByTargetName.set(targetName, {
              ...row,
              id: targetKey(requester.memberId as number, targetName),
              requestedTargetName: targetName,
              keywords: normalizeStringList(row.keyword),
              requesterMemberId: requester.memberId as number,
              requester: {
                name: requester.name || rowEmail || '확인 불가',
                email: requester.email || rowEmail,
              },
              createdAt: normalizeHelperDate(row.date_created),
              updatedAt: normalizeHelperDate(row.date_updated),
            });
          });
      });
    }
    if (failedMemberCount > 0) {
      throw new BadGatewayException({
        message: 'Failed to load all patent target requests',
        code: 'PATENT_TARGET_REQUESTS_PARTIAL_FAILURE',
        failedMemberCount,
      });
    }
    return [...pendingByTargetName.values()];
  }

  async decideTarget(
    adminUserId: string,
    encodedTarget: string,
    approve: boolean,
    body: PatentTargetDecisionDto,
  ) {
    const member = await this.members.resolve(adminUserId);
    const { targetName: originalName } = this.decodeTargetKey(encodedTarget);
    const nextName = body.targetName?.trim() || originalName;
    const keywords = this.normalizeKeywords(body.keywords ?? []);
    this.assertSafeTargetValue(originalName);
    this.assertSafeTargetValue(nextName);
    keywords.forEach((value) => this.assertSafeTargetValue(value));
    return this.helper.call({
      operation: approve ? 'CONFIRM-NEW-TARGET' : 'DELETE-NEW-TARGET',
      actionType: approve ? 'CONFIRM-NEW-TARGET' : 'DELETE-NEW-TARGET',
      owner_id: member.memberId,
      origin_target_name: originalName,
      new_target_name: nextName,
      keyword: keywords.join(','),
    });
  }

  async modifyTarget(adminUserId: string, originalName: string, body: PatentTargetDecisionDto) {
    const member = await this.members.resolve(adminUserId);
    const nextName = body.targetName?.trim() || originalName;
    const keywords = this.normalizeKeywords(body.keywords ?? []);
    this.assertSafeTargetValue(originalName);
    this.assertSafeTargetValue(nextName);
    keywords.forEach((value) => this.assertSafeTargetValue(value));
    return this.helper.call({
      operation: 'CONFIRM-NEW-TARGET',
      actionType: 'CONFIRM-NEW-TARGET',
      owner_id: member.memberId,
      origin_target_name: originalName,
      new_target_name: nextName,
      keyword: keywords.join(','),
    });
  }

  async deleteTarget(adminUserId: string, originalName: string) {
    const member = await this.members.resolve(adminUserId);
    this.assertSafeTargetValue(originalName);
    return this.helper.call({
      operation: 'DELETE-NEW-TARGET',
      actionType: 'DELETE-NEW-TARGET',
      owner_id: member.memberId,
      origin_target_name: originalName,
    });
  }

  private getTargetList(memberId: number) {
    return this.helper.call<TargetListResult>({
      operation: 'GET-TARGET-LIST',
      actionType: 'GET-TARGET-LIST',
      owner_id: memberId,
    });
  }

  private async getCanonicalNotificationPreferences(memberId: number) {
    const result = await this.getTargetList(memberId);
    return this.normalizeNotificationPreferences(result);
  }

  private normalizeNotificationPreferences(
    result: TargetListResult,
  ): PatentNotificationPreferences {
    const alarmRows = Array.isArray(result.user_to_alarm)
      ? result.user_to_alarm
      : result.user_to_alarm
        ? [result.user_to_alarm]
        : [];
    const firstAlarm = alarmRows[0] as TargetRow | undefined;

    return {
      enabled: normalizeBoolean(firstAlarm?.mail),
      availableTargets: this.normalizeNotificationTargets(result.rows, false),
      selectedTargets: this.normalizeNotificationTargets(result.selected_rows, true),
    };
  }

  private normalizeNotificationTargets(
    value: unknown,
    preservePending: boolean,
  ): PatentNotificationTarget[] {
    if (!Array.isArray(value)) return [];
    const targets = new Map<string, PatentNotificationTarget>();
    value.forEach((item) => {
      if (!item || typeof item !== 'object') return;
      const row = item as TargetRow;
      const targetName = normalizeTargetName(row);
      if (!targetName) return;
      const key = targetName.toLowerCase();
      const existing = targets.get(key);
      const keywords = normalizeStringList(row.keyword ?? row.keywords);
      targets.set(key, {
        targetName: existing?.targetName ?? targetName,
        keywords: [...new Set([...(existing?.keywords ?? []), ...keywords])],
        pending: preservePending
          ? Boolean(existing?.pending || normalizeBoolean(row.pending))
          : false,
      });
    });
    return [...targets.values()].sort((left, right) =>
      left.targetName.localeCompare(right.targetName));
  }

  private findTarget(targets: PatentNotificationTarget[], targetName: string) {
    const normalized = targetName.toLowerCase();
    return targets.find((target) => target.targetName.toLowerCase() === normalized);
  }

  private validateNotificationTargetName(value: string) {
    const targetName = String(value ?? '').trim();
    if (
      !targetName
      || targetName.length > 200
      || /['"\\\u0000-\u001f]/.test(targetName)
    ) {
      throw new BadRequestException('PATENT_NOTIFICATION_TARGET_INVALID');
    }
    return targetName;
  }

  private decodeTargetKey(value: string): { memberId: number; targetName: string } {
    try {
      const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
      if (!Number.isInteger(parsed.memberId) || typeof parsed.targetName !== 'string') throw new Error();
      return parsed;
    } catch {
      throw new BadRequestException('PATENT_TARGET_KEY_INVALID');
    }
  }

  private normalizeKeywords(values: string[]) {
    return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  }

  private assertPublicationNumber(value: string) {
    if (!/^[A-Za-z0-9][A-Za-z0-9./_-]{0,99}$/.test(value)) {
      throw new BadRequestException('PATENT_PUBLICATION_NUMBER_INVALID');
    }
  }

  private assertSafeTargetValue(value: string) {
    if (!value || /['"\\\u0000-\u001f]/.test(value)) {
      throw new BadRequestException('PATENT_TARGET_VALUE_INVALID');
    }
  }

  private escapeHelperSqlText(value: string) {
    return value.replaceAll("'", "''");
  }

  private async validateBioactivityHeaders(file: UploadFile) {
    const extension = file.originalname.toLowerCase().split('.').pop();
    let headers: string[] = [];
    if (extension === 'csv') {
      headers = file.buffer.toString('utf8').split(/\r?\n/, 1)[0]
        .split(',').map((value) => value.replace(/^"|"$/g, '').trim());
    } else if (extension === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(file.buffer as never);
      const row = workbook.worksheets[0]?.getRow(1);
      headers = (row?.values as unknown[] ?? []).slice(1).map((value) => String(value ?? '').trim());
    } else {
      throw new BadRequestException('BIOACTIVITY_FILE_TYPE_UNSUPPORTED');
    }
    const structures = headers.filter((value) => ['SMILES', 'canonical_smiles'].includes(value));
    const identities = headers.filter((value) => ['compound_id', 'example_number'].includes(value));
    if (structures.length !== 1 || identities.length !== 1) {
      throw new BadRequestException('BIOACTIVITY_REQUIRED_COLUMNS_INVALID');
    }
  }
}
