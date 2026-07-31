import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  Alert,
  App,
  Button,
  Card,
  DatePicker,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  Upload,
} from 'antd';
import type { TableColumnsType, UploadFile } from 'antd';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import {
  ExternalLink,
  FileSpreadsheet,
  Mail,
  Pencil,
  PlayCircle,
  Plus,
  RefreshCw,
  RotateCcw,
  SearchCheck,
  Trash2,
  UploadCloud,
  UsersRound,
} from 'lucide-react';
import PageHeaderBreadcrumb from '../components/common/PageHeaderBreadcrumb';
import { useAccessContext } from '../contexts/AccessContext';
import {
  conferenceAdminApi,
  type AdminConferenceAbstractItem,
  type AdminConferenceAbstractListParams,
  type AdminConferenceItem,
  type AdminConferenceListParams,
  type AdminConferenceOption,
  type ConferenceImportBatch,
  type ConferenceImportIssue,
  type ConferenceImportRun,
  type ConferenceMailHealth,
  type ConferenceMailOutboxItem,
  type NotificationRecipientImportIssue,
  type NotificationRecipientImportBatch,
  type NotificationRecipientImportRun,
} from '../services/conferenceAdminApi';
import { useUIStore } from '../store/useUIStore';
import { useViewportTableHeight } from '../hooks/useViewportTableHeight';
import { formatDisplayDate, formatNumberWithComma } from '../utils/displayFormat';

const { Text } = Typography;

interface ConferenceFormValues {
  title: string;
  abbreviation: string;
  fullTitle?: string;
  year: number;
  status: 'OPEN' | 'NOT_OPENED';
  sourceUrl?: string;
  dateRange?: [Dayjs, Dayjs];
}

interface AbstractFormValues {
  conferenceId: string;
  title: string;
  abstractNumber?: string;
  firstAuthorName?: string;
  firstAuthorOrganization?: string;
  sourceUrl?: string;
  meeting?: string;
  sessionType?: string;
  sessionTitle?: string;
  track?: string;
  subTrack?: string;
  posterNumber?: string;
  clinicalTrialRegistrationNumber?: string;
  dateOpen?: Dayjs;
  authorsText?: string;
  contentsJson?: string;
}

const runStatusColor: Record<string, string> = {
  COMPLETED: 'success',
  SENT: 'success',
  PARTIAL: 'warning',
  RETRY: 'warning',
  FAILED: 'error',
  RUNNING: 'processing',
  PROCESSING: 'processing',
  PENDING: 'default',
};

const ConferenceAdmin: React.FC = () => {
  const { hasPermission } = useAccessContext();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { setHeaderContent } = useUIStore();
  const [conferenceForm] = Form.useForm<ConferenceFormValues>();
  const [abstractForm] = Form.useForm<AbstractFormValues>();
  const [batches, setBatches] = useState<ConferenceImportBatch[]>([]);
  const [runs, setRuns] = useState<ConferenceImportRun[]>([]);
  const [recipientBatches, setRecipientBatches] =
    useState<NotificationRecipientImportBatch[]>([]);
  const [recipientRuns, setRecipientRuns] = useState<NotificationRecipientImportRun[]>([]);
  const [mailHealth, setMailHealth] = useState<ConferenceMailHealth | null>(null);
  const [mailOutboxes, setMailOutboxes] = useState<ConferenceMailOutboxItem[]>([]);
  const [conferences, setConferences] = useState<AdminConferenceOption[]>([]);
  const [conferenceRows, setConferenceRows] = useState<AdminConferenceItem[]>([]);
  const [conferenceTotal, setConferenceTotal] = useState(0);
  const [conferenceListLoading, setConferenceListLoading] = useState(false);
  const [conferenceQuery, setConferenceQuery] = useState<AdminConferenceListParams>({
    deleted: 'active',
    sort: 'yearDesc',
    page: 1,
    pageSize: 10,
  });
  const [editingConference, setEditingConference] =
    useState<AdminConferenceItem | null>(null);
  const [conferenceModalOpen, setConferenceModalOpen] = useState(false);
  const [conferenceMutatingId, setConferenceMutatingId] = useState<string>();
  const [abstractRows, setAbstractRows] = useState<AdminConferenceAbstractItem[]>([]);
  const [abstractTotal, setAbstractTotal] = useState(0);
  const [abstractListLoading, setAbstractListLoading] = useState(false);
  const [abstractQuery, setAbstractQuery] =
    useState<AdminConferenceAbstractListParams>({
      deleted: 'active',
      sort: 'updatedDesc',
      page: 1,
      pageSize: 10,
    });
  const [editingAbstract, setEditingAbstract] =
    useState<AdminConferenceAbstractItem | null>(null);
  const [abstractModalOpen, setAbstractModalOpen] = useState(false);
  const [abstractMutatingId, setAbstractMutatingId] = useState<string>();
  const [selectedBatch, setSelectedBatch] = useState<string>();
  const [uploadBatchKey, setUploadBatchKey] = useState('');
  const [uploadBatchKind, setUploadBatchKind] =
    useState<'LEGACY' | 'API_METADATA'>('LEGACY');
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [uploadingBatch, setUploadingBatch] = useState(false);
  const [selectedRecipientBatch, setSelectedRecipientBatch] = useState<string>();
  const [recipientUploadBatchKey, setRecipientUploadBatchKey] = useState('');
  const [recipientUploadFile, setRecipientUploadFile] = useState<UploadFile[]>([]);
  const [uploadingRecipientBatch, setUploadingRecipientBatch] = useState(false);
  const [profileVersion, setProfileVersion] = useState('v1');
  const [loading, setLoading] = useState(false);
  const [startingMode, setStartingMode] = useState<'DRY_RUN' | 'APPLY' | null>(null);
  const [savingConference, setSavingConference] = useState(false);
  const [savingAbstract, setSavingAbstract] = useState(false);
  const [selectedRun, setSelectedRun] = useState<ConferenceImportRun | null>(null);
  const [selectedRecipientRun, setSelectedRecipientRun] =
    useState<NotificationRecipientImportRun | null>(null);
  const [startingRecipientMode, setStartingRecipientMode] =
    useState<'DRY_RUN' | 'APPLY' | 'RECONCILE' | null>(null);
  const [retryingMailIds, setRetryingMailIds] = useState<Set<string>>(new Set());
  const [activeTabKey, setActiveTabKey] = useState('conference');
  const importTable = useViewportTableHeight({
    enabled: activeTabKey === 'import',
    fitToRegion: true,
    minHeight: 100,
  });
  const recipientTable = useViewportTableHeight({
    enabled: activeTabKey === 'recipients',
    fitToRegion: true,
    minHeight: 100,
    refreshKey: [
      loading,
      recipientRuns.length,
      selectedRecipientBatch,
    ].join(':'),
  });
  const mailTable = useViewportTableHeight({
    enabled: activeTabKey === 'mail-outbox',
    fitToRegion: true,
    minHeight: 100,
    refreshKey: [
      loading,
      mailOutboxes.length,
    ].join(':'),
  });
  const conferenceManagementTable = useViewportTableHeight({
    enabled: activeTabKey === 'conference',
    fitToRegion: true,
    refreshKey: [
      conferenceListLoading,
      conferenceRows.length,
      conferenceTotal,
      conferenceQuery.page,
      conferenceQuery.pageSize,
    ].join(':'),
  });
  const abstractManagementTable = useViewportTableHeight({
    enabled: activeTabKey === 'abstract',
    fitToRegion: true,
    refreshKey: [
      abstractListLoading,
      abstractRows.length,
      abstractTotal,
      abstractQuery.page,
      abstractQuery.pageSize,
    ].join(':'),
  });
  const canManageConference = hasPermission('conference.manage');

  useEffect(() => {
    setHeaderContent(
      <PageHeaderBreadcrumb
        items={[
          { label: 'Conference 관리' },
        ]}
      />,
    );
    return () => setHeaderContent(null);
  }, [setHeaderContent]);

  const loadAdminData = useCallback(async () => {
    if (!canManageConference) return;
    setLoading(true);
    try {
      const [
        nextBatches,
        nextRuns,
        nextRecipientBatches,
        nextRecipientRuns,
        nextMailHealth,
        nextMailOutboxes,
        conferenceResponse,
      ] = await Promise.all([
        conferenceAdminApi.listBatches(),
        conferenceAdminApi.listRuns(50),
        conferenceAdminApi.listRecipientImportBatches(),
        conferenceAdminApi.listRecipientImportRuns(),
        conferenceAdminApi.getMailHealth(),
        conferenceAdminApi.listMailOutboxes(),
        conferenceAdminApi.listConferenceOptions(),
      ]);
      setBatches(nextBatches);
      setRuns(nextRuns);
      setRecipientBatches(nextRecipientBatches);
      setRecipientRuns(nextRecipientRuns);
      setMailHealth(nextMailHealth);
      setMailOutboxes(nextMailOutboxes);
      setConferences(conferenceResponse);
      setSelectedBatch((current) => (
        current && nextBatches.some(({ batchKey }) => batchKey === current)
          ? current
          : nextBatches[0]?.batchKey
      ));
      setSelectedRecipientBatch((current) => (
        current && nextRecipientBatches.some(({ batchKey }) => batchKey === current)
          ? current
          : nextRecipientBatches[0]?.batchKey
      ));
    } catch (error) {
      void message.error(error instanceof Error ? error.message : 'Conference 관리 정보를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [canManageConference, message]);

  const loadConferenceOptions = useCallback(async () => {
    const nextConferences = await conferenceAdminApi.listConferenceOptions();
    setConferences(nextConferences);
  }, []);

  const loadConferenceRows = useCallback(async () => {
    if (!canManageConference) return;
    setConferenceListLoading(true);
    try {
      const response = await conferenceAdminApi.listConferences(conferenceQuery);
      setConferenceRows(response.items);
      setConferenceTotal(response.total);
    } catch (error) {
      void message.error(
        error instanceof Error ? error.message : 'Conference 목록을 불러오지 못했습니다.',
      );
    } finally {
      setConferenceListLoading(false);
    }
  }, [canManageConference, conferenceQuery, message]);

  const loadAbstractRows = useCallback(async () => {
    if (!canManageConference) return;
    setAbstractListLoading(true);
    try {
      const response = await conferenceAdminApi.listAbstracts(abstractQuery);
      setAbstractRows(response.items);
      setAbstractTotal(response.total);
    } catch (error) {
      void message.error(
        error instanceof Error ? error.message : 'Abstract 목록을 불러오지 못했습니다.',
      );
    } finally {
      setAbstractListLoading(false);
    }
  }, [abstractQuery, canManageConference, message]);

  useEffect(() => {
    void loadAdminData();
  }, [loadAdminData]);

  useEffect(() => {
    if (activeTabKey === 'conference') void loadConferenceRows();
  }, [activeTabKey, loadConferenceRows]);

  useEffect(() => {
    if (activeTabKey === 'abstract') void loadAbstractRows();
  }, [activeTabKey, loadAbstractRows]);

  useEffect(() => {
    const importPending = runs.some(
      ({ status }) => status === 'PENDING' || status === 'RUNNING',
    );
    const mailPending = mailOutboxes.some(
      ({ status }) => status === 'PENDING'
        || status === 'PROCESSING'
        || status === 'RETRY',
    );
    if (!importPending && !mailPending) return;
    const intervalId = window.setInterval(() => void loadAdminData(), 5000);
    return () => window.clearInterval(intervalId);
  }, [loadAdminData, mailOutboxes, runs]);

  const successfulDryRun = useMemo(() => {
    const batch = batches.find(({ batchKey }) => batchKey === selectedBatch);
    return runs.find((run) => (
      run.mode === 'DRY_RUN'
      && (
        run.batchKey === selectedBatch
        || Boolean(batch?.sourceChecksum && run.sourceChecksum === batch.sourceChecksum)
      )
      && run.profileVersion === profileVersion
      && run.status === 'COMPLETED'
      && run.errorCount === 0
    ));
  }, [batches, profileVersion, runs, selectedBatch]);
  const successfulRecipientDryRun = useMemo(() => {
    const batch = recipientBatches.find(
      ({ batchKey }) => batchKey === selectedRecipientBatch,
    );
    if (!batch) return undefined;
    return recipientRuns.find((run) => (
      run.mode === 'DRY_RUN'
      && run.sourceChecksum === batch.sourceChecksum
      && run.status === 'COMPLETED'
      && run.errorCount === 0
      && run.conflictCount === 0
    ));
  }, [recipientBatches, recipientRuns, selectedRecipientBatch]);

  const startImport = async (mode: 'DRY_RUN' | 'APPLY') => {
    if (!selectedBatch) return;
    setStartingMode(mode);
    try {
      const run = mode === 'DRY_RUN'
        ? await conferenceAdminApi.createDryRun(selectedBatch, profileVersion)
        : await conferenceAdminApi.createApply(selectedBatch, profileVersion);
      setRuns((current) => [run, ...current.filter(({ id }) => id !== run.id)]);
      void message.success(mode === 'DRY_RUN' ? 'Dry-run을 요청했습니다.' : 'Metadata import를 요청했습니다.');
    } catch (error) {
      void message.error(error instanceof Error ? error.message : 'Import 요청에 실패했습니다.');
    } finally {
      setStartingMode(null);
    }
  };

  const uploadImportBatch = async () => {
    const batchKey = uploadBatchKey.trim();
    const files = uploadFiles
      .map(({ originFileObj }) => originFileObj)
      .filter((file): file is NonNullable<typeof file> => Boolean(file));
    if (!batchKey || files.length === 0) {
      void message.warning('Batch key와 업로드 파일을 확인해 주세요.');
      return;
    }
    setUploadingBatch(true);
    try {
      const batch = await conferenceAdminApi.uploadBatch(
        batchKey,
        uploadBatchKind,
        files,
      );
      setUploadBatchKey('');
      setUploadFiles([]);
      setSelectedBatch(batch.batchKey);
      void message.success(`Import batch ${batch.batchKey} 업로드를 완료했습니다.`);
      await loadAdminData();
      setSelectedBatch(batch.batchKey);
    } catch (error) {
      void message.error(
        error instanceof Error ? error.message : 'Import batch 업로드에 실패했습니다.',
      );
    } finally {
      setUploadingBatch(false);
    }
  };

  const openRun = async (runId: string) => {
    try {
      setSelectedRun(await conferenceAdminApi.getRun(runId));
    } catch (error) {
      void message.error(error instanceof Error ? error.message : 'Import 상세를 불러오지 못했습니다.');
    }
  };

  const startRecipientImport = async (mode: 'DRY_RUN' | 'APPLY') => {
    if (!selectedRecipientBatch) return;
    setStartingRecipientMode(mode);
    try {
      const run = mode === 'DRY_RUN'
        ? await conferenceAdminApi.createRecipientDryRun(selectedRecipientBatch)
        : await conferenceAdminApi.createRecipientApply(selectedRecipientBatch);
      setRecipientRuns((current) => [
        run,
        ...current.filter(({ id }) => id !== run.id),
      ]);
      void message.success(
        mode === 'DRY_RUN'
          ? '사용자 이메일 Dry-run을 완료했습니다.'
          : '사용자 이메일 이관을 완료했습니다.',
      );
    } catch (error) {
      void message.error(
        error instanceof Error
          ? error.message
          : '사용자 이메일 이관 요청에 실패했습니다.',
      );
    } finally {
      setStartingRecipientMode(null);
    }
  };

  const uploadRecipientBatch = async () => {
    const batchKey = recipientUploadBatchKey.trim();
    const file = recipientUploadFile[0]?.originFileObj;
    if (!batchKey || !file) {
      void message.warning('Batch key와 JSON 파일을 확인해 주세요.');
      return;
    }
    setUploadingRecipientBatch(true);
    try {
      const batch = await conferenceAdminApi.uploadRecipientImportBatch(
        batchKey,
        file,
      );
      setRecipientUploadBatchKey('');
      setRecipientUploadFile([]);
      void message.success(`메일 대상 batch ${batch.batchKey} 업로드를 완료했습니다.`);
      await loadAdminData();
      setSelectedRecipientBatch(batch.batchKey);
    } catch (error) {
      void message.error(
        error instanceof Error
          ? error.message
          : '메일 대상 batch 업로드에 실패했습니다.',
      );
    } finally {
      setUploadingRecipientBatch(false);
    }
  };

  const retryMailOutbox = async (outboxId: string) => {
    setRetryingMailIds((current) => new Set(current).add(outboxId));
    try {
      await conferenceAdminApi.retryMailOutbox(outboxId);
      void message.success('메일 재시도를 요청했습니다.');
      await loadAdminData();
    } catch (error) {
      void message.error(error instanceof Error ? error.message : '메일 재시도를 요청하지 못했습니다.');
    } finally {
      setRetryingMailIds((current) => {
        const next = new Set(current);
        next.delete(outboxId);
        return next;
      });
    }
  };

  const reconcileRecipientUsers = async () => {
    setStartingRecipientMode('RECONCILE');
    try {
      const result = await conferenceAdminApi.reconcileRecipientUsers();
      void message.success(
        `User 동기화 완료: ${formatNumberWithComma(result.syncedCount)}건`,
      );
      await loadAdminData();
    } catch (error) {
      void message.error(
        error instanceof Error ? error.message : 'User 동기화에 실패했습니다.',
      );
    } finally {
      setStartingRecipientMode(null);
    }
  };

  const openRecipientRun = async (runId: string) => {
    try {
      setSelectedRecipientRun(
        await conferenceAdminApi.getRecipientImportRun(runId),
      );
    } catch (error) {
      void message.error(
        error instanceof Error ? error.message : '사용자 이메일 이관 상세를 불러오지 못했습니다.',
      );
    }
  };

  const saveConference = async () => {
    let values: ConferenceFormValues;
    try {
      values = await conferenceForm.validateFields();
    } catch {
      return;
    }
    setSavingConference(true);
    try {
      const payload = {
        title: values.title.trim(),
        abbreviation: values.abbreviation.trim(),
        fullTitle: values.fullTitle?.trim(),
        year: values.year,
        status: values.status,
        sourceUrl: values.sourceUrl?.trim(),
        dateStart: values.dateRange?.[0].format('YYYY-MM-DD'),
        dateEnd: values.dateRange?.[1].format('YYYY-MM-DD'),
      };
      if (editingConference) {
        await conferenceAdminApi.updateConference(editingConference.id, {
          ...payload,
          dateStart: payload.dateStart ?? null,
          dateEnd: payload.dateEnd ?? null,
          expectedUpdatedAt: editingConference.updatedAt,
        });
      } else {
        await conferenceAdminApi.createConference(payload);
      }
      conferenceForm.resetFields();
      setConferenceModalOpen(false);
      setEditingConference(null);
      void message.success(
        editingConference ? 'Conference를 수정했습니다.' : 'Conference를 등록했습니다.',
      );
      await Promise.all([loadConferenceRows(), loadConferenceOptions()]);
    } catch (error) {
      void message.error(error instanceof Error ? error.message : 'Conference 저장에 실패했습니다.');
    } finally {
      setSavingConference(false);
    }
  };

  const saveAbstract = async () => {
    let values: AbstractFormValues;
    try {
      values = await abstractForm.validateFields();
    } catch {
      return;
    }
    setSavingAbstract(true);
    try {
      const payload = {
        title: values.title.trim(),
        abstractNumber: values.abstractNumber?.trim(),
        firstAuthorName: values.firstAuthorName?.trim(),
        firstAuthorOrganization: values.firstAuthorOrganization?.trim(),
        sourceUrl: values.sourceUrl?.trim(),
        meeting: values.meeting?.trim(),
        sessionType: values.sessionType?.trim(),
        sessionTitle: values.sessionTitle?.trim(),
        track: values.track?.trim(),
        subTrack: values.subTrack?.trim(),
        posterNumber: values.posterNumber?.trim(),
        clinicalTrialRegistrationNumber: values.clinicalTrialRegistrationNumber?.trim(),
        dateOpen: values.dateOpen?.format('YYYY-MM-DD'),
        authors: values.authorsText?.split(',').map((author) => author.trim()).filter(Boolean),
        contentsJson: values.contentsJson?.trim(),
      };
      if (editingAbstract) {
        await conferenceAdminApi.updateAbstract(editingAbstract.id, {
          ...payload,
          dateOpen: payload.dateOpen ?? null,
          conferenceId: values.conferenceId,
          expectedUpdatedAt: editingAbstract.updatedAt,
        });
      } else {
        await conferenceAdminApi.createAbstract(values.conferenceId, payload);
      }
      abstractForm.resetFields();
      setAbstractModalOpen(false);
      setEditingAbstract(null);
      void message.success(
        editingAbstract ? 'Abstract를 수정했습니다.' : 'Abstract를 등록했습니다.',
      );
      await loadAbstractRows();
    } catch (error) {
      void message.error(error instanceof Error ? error.message : 'Abstract 저장에 실패했습니다.');
    } finally {
      setSavingAbstract(false);
    }
  };

  const openConferenceForm = (conference?: AdminConferenceItem) => {
    setEditingConference(conference ?? null);
    conferenceForm.setFieldsValue(conference ? {
      title: conference.title,
      abbreviation: conference.abbreviation,
      fullTitle: conference.fullTitle ?? undefined,
      year: conference.year,
      status: conference.status,
      sourceUrl: conference.sourceUrl ?? undefined,
      dateRange: conference.dateStart && conference.dateEnd
        ? [dayjs(conference.dateStart), dayjs(conference.dateEnd)]
        : undefined,
    } : {
      title: undefined,
      abbreviation: undefined,
      fullTitle: undefined,
      year: undefined,
      status: 'OPEN',
      sourceUrl: undefined,
      dateRange: undefined,
    });
    setConferenceModalOpen(true);
  };

  const openAbstractForm = (abstract?: AdminConferenceAbstractItem) => {
    setEditingAbstract(abstract ?? null);
    const authorValues = Array.isArray(abstract?.authors)
      ? abstract.authors.filter((value): value is string => typeof value === 'string')
      : [];
    abstractForm.setFieldsValue(abstract ? {
      conferenceId: abstract.conferenceId,
      title: abstract.title,
      abstractNumber: abstract.abstractNumber ?? undefined,
      firstAuthorName: abstract.firstAuthorName ?? undefined,
      firstAuthorOrganization: abstract.firstAuthorOrganization ?? undefined,
      sourceUrl: abstract.sourceUrl ?? undefined,
      meeting: abstract.meeting ?? undefined,
      sessionType: abstract.sessionType ?? undefined,
      sessionTitle: abstract.sessionTitle ?? undefined,
      track: abstract.track ?? undefined,
      subTrack: abstract.subTrack ?? undefined,
      posterNumber: abstract.posterNumber ?? undefined,
      clinicalTrialRegistrationNumber:
        abstract.clinicalTrialRegistrationNumber ?? undefined,
      dateOpen: abstract.dateOpen ? dayjs(abstract.dateOpen) : undefined,
      authorsText: authorValues.join(', '),
      contentsJson: typeof abstract.contents === 'string'
        ? abstract.contents
        : abstract.contents == null
          ? undefined
          : JSON.stringify(abstract.contents, null, 2),
    } : {
      conferenceId: abstractQuery.conferenceId,
      title: undefined,
      abstractNumber: undefined,
      firstAuthorName: undefined,
      firstAuthorOrganization: undefined,
      sourceUrl: undefined,
      meeting: undefined,
      sessionType: undefined,
      sessionTitle: undefined,
      track: undefined,
      subTrack: undefined,
      posterNumber: undefined,
      clinicalTrialRegistrationNumber: undefined,
      dateOpen: undefined,
      authorsText: undefined,
      contentsJson: undefined,
    });
    setAbstractModalOpen(true);
  };

  const deleteConference = async (conference: AdminConferenceItem) => {
    setConferenceMutatingId(conference.id);
    try {
      await conferenceAdminApi.deleteConference(conference.id, conference.updatedAt);
      void message.success('Conference를 삭제했습니다.');
      await Promise.all([loadConferenceRows(), loadConferenceOptions()]);
    } catch (error) {
      void message.error(error instanceof Error ? error.message : 'Conference 삭제에 실패했습니다.');
    } finally {
      setConferenceMutatingId(undefined);
    }
  };

  const restoreConference = async (conference: AdminConferenceItem) => {
    setConferenceMutatingId(conference.id);
    try {
      await conferenceAdminApi.restoreConference(conference.id);
      void message.success('Conference를 복구했습니다.');
      await Promise.all([loadConferenceRows(), loadConferenceOptions()]);
    } catch (error) {
      void message.error(error instanceof Error ? error.message : 'Conference 복구에 실패했습니다.');
    } finally {
      setConferenceMutatingId(undefined);
    }
  };

  const deleteAbstract = async (abstract: AdminConferenceAbstractItem) => {
    setAbstractMutatingId(abstract.id);
    try {
      await conferenceAdminApi.deleteAbstract(abstract.id, abstract.updatedAt);
      void message.success('Abstract를 삭제했습니다.');
      await loadAbstractRows();
    } catch (error) {
      void message.error(error instanceof Error ? error.message : 'Abstract 삭제에 실패했습니다.');
    } finally {
      setAbstractMutatingId(undefined);
    }
  };

  const restoreAbstract = async (abstract: AdminConferenceAbstractItem) => {
    setAbstractMutatingId(abstract.id);
    try {
      await conferenceAdminApi.restoreAbstract(abstract.id);
      void message.success('Abstract를 복구했습니다.');
      await loadAbstractRows();
    } catch (error) {
      void message.error(error instanceof Error ? error.message : 'Abstract 복구에 실패했습니다.');
    } finally {
      setAbstractMutatingId(undefined);
    }
  };

  const runColumns: TableColumnsType<ConferenceImportRun> = [
    {
      title: '시작',
      dataIndex: 'startedAt',
      width: 150,
      align: 'center',
      render: formatDisplayDate,
    },
    {
      title: 'Batch',
      dataIndex: 'batchKey',
      width: 130,
      align: 'center',
    },
    {
      title: 'Version',
      dataIndex: 'profileVersion',
      width: 160,
      align: 'center',
    },
    {
      title: 'Mode',
      dataIndex: 'mode',
      width: 90,
      align: 'center',
      render: (mode: string) => <Tag color={mode === 'APPLY' ? 'volcano' : 'blue'}>{mode}</Tag>,
    },
    {
      title: '상태',
      dataIndex: 'status',
      width: 100,
      align: 'center',
      render: (status: string) => <Tag color={runStatusColor[status]}>{status}</Tag>,
    },
    {
      title: '등록',
      dataIndex: 'insertedCount',
      width: 80,
      align: 'center',
      render: (value) => formatNumberWithComma(value),
    },
    {
      title: '수정',
      dataIndex: 'updatedCount',
      width: 80,
      align: 'center',
      render: (value) => formatNumberWithComma(value),
    },
    {
      title: '검사/Skip',
      key: 'processedCount',
      width: 80,
      align: 'center',
      render: (_, run) => formatNumberWithComma(
        run.mode === 'DRY_RUN' ? run.inspectedCount ?? 0 : run.skippedCount,
      ),
    },
    {
      title: '오류',
      dataIndex: 'errorCount',
      width: 70,
      align: 'center',
      render: (value) => formatNumberWithComma(value),
    },
    {
      title: '상세',
      key: 'action',
      width: 70,
      align: 'center',
      render: (_, run) => <Button size="small" onClick={() => void openRun(run.id)}>보기</Button>,
    },
  ];

  const issueColumns: TableColumnsType<ConferenceImportIssue> = [
    { title: '등급', dataIndex: 'severity', width: 80 },
    { title: '코드', dataIndex: 'errorCode', width: 210 },
    { title: '파일', dataIndex: 'sourceFile', width: 240, ellipsis: true },
    { title: '행', dataIndex: 'rowNumber', width: 70, render: (value) => value ?? '-' },
    { title: '내용', dataIndex: 'message', ellipsis: true },
  ];

  const recipientRunColumns: TableColumnsType<NotificationRecipientImportRun> = [
    {
      title: '시작',
      dataIndex: 'startedAt',
      width: 150,
      render: formatDisplayDate,
    },
    {
      title: 'Batch',
      key: 'batchKey',
      width: 180,
      ellipsis: true,
      render: (_, run) => run.batch?.batchKey ?? '-',
    },
    {
      title: 'Version',
      dataIndex: 'profileVersion',
      width: 160,
    },
    {
      title: 'Mode',
      dataIndex: 'mode',
      width: 90,
      render: (mode: string) => (
        <Tag color={mode === 'APPLY' ? 'volcano' : 'blue'}>{mode}</Tag>
      ),
    },
    {
      title: '상태',
      dataIndex: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={runStatusColor[status]}>{status}</Tag>
      ),
    },
    {
      title: '원본',
      dataIndex: 'sourceCount',
      width: 80,
      align: 'right',
      render: (value) => formatNumberWithComma(value),
    },
    {
      title: '등록',
      dataIndex: 'insertedCount',
      width: 80,
      align: 'right',
      render: (value) => formatNumberWithComma(value),
    },
    {
      title: '수정',
      dataIndex: 'updatedCount',
      width: 80,
      align: 'right',
      render: (value) => formatNumberWithComma(value),
    },
    {
      title: '동일',
      dataIndex: 'unchangedCount',
      width: 80,
      align: 'right',
      render: (value) => formatNumberWithComma(value),
    },
    {
      title: '제외',
      dataIndex: 'skippedCount',
      width: 80,
      align: 'right',
      render: (value) => formatNumberWithComma(value),
    },
    {
      title: '충돌/오류',
      key: 'problemCount',
      width: 100,
      align: 'right',
      render: (_, run) => formatNumberWithComma(
        run.conflictCount + run.errorCount,
      ),
    },
    {
      title: '상세',
      key: 'action',
      width: 70,
      render: (_, run) => (
        <Button size="small" onClick={() => void openRecipientRun(run.id)}>
          보기
        </Button>
      ),
    },
  ];

  const recipientIssueColumns: TableColumnsType<NotificationRecipientImportIssue> = [
    { title: '등급', dataIndex: 'severity', width: 80 },
    { title: '코드', dataIndex: 'errorCode', width: 220 },
    {
      title: '행',
      dataIndex: 'rowNumber',
      width: 70,
      render: (value) => value ?? '-',
    },
    {
      title: 'Member ID',
      dataIndex: 'memberId',
      width: 100,
      render: (value) => value ?? '-',
    },
    { title: '내용', dataIndex: 'message', ellipsis: true },
  ];

  const mailOutboxColumns: TableColumnsType<ConferenceMailOutboxItem> = [
    {
      title: '요청일',
      dataIndex: 'createdAt',
      width: 132,
      render: formatDisplayDate,
    },
    {
      title: '수신자',
      key: 'recipient',
      width: 220,
      render: (_, item) => (
        <div>
          <div>{item.recipientNameSnapshot}</div>
          <Text type="secondary">{item.recipientEmailSnapshot}</Text>
        </div>
      ),
    },
    {
      title: 'Abstract',
      key: 'abstract',
      ellipsis: true,
      render: (_, item) => item.comment.abstract.title,
    },
    {
      title: '상태',
      dataIndex: 'status',
      width: 100,
      align: 'center',
      render: (status: string) => (
        <Tag color={runStatusColor[status] || 'default'}>{status}</Tag>
      ),
    },
    {
      title: '시도',
      key: 'attempts',
      width: 82,
      align: 'center',
      render: (_, item) => `${formatNumberWithComma(item.attemptCount)} / ${formatNumberWithComma(item.maxAttempts)}`,
    },
    {
      title: '오류',
      dataIndex: 'lastErrorCode',
      width: 180,
      ellipsis: true,
      render: (value: string | null) => value || '-',
    },
    {
      title: '발송일',
      dataIndex: 'sentAt',
      width: 132,
      render: (value: string | null) => value ? formatDisplayDate(value) : '-',
    },
    {
      title: '작업',
      key: 'action',
      width: 90,
      align: 'center',
      render: (_, item) => (
        <Button
          size="small"
          disabled={item.status !== 'FAILED'}
          loading={retryingMailIds.has(item.id)}
          onClick={() => void retryMailOutbox(item.id)}
        >
          재시도
        </Button>
      ),
    },
  ];

  const conferenceColumns: TableColumnsType<AdminConferenceItem> = [
    {
      title: '연도',
      dataIndex: 'year',
      width: 76,
      align: 'center',
    },
    {
      title: '약어',
      dataIndex: 'abbreviation',
      width: 120,
      align: 'center',
    },
    {
      title: 'Conference key',
      dataIndex: 'title',
      width: 180,
      align: 'center',
      ellipsis: true,
    },
    { title: '정식 명칭', dataIndex: 'fullTitle', ellipsis: true, render: (value) => value || '-' },
    {
      title: '상태',
      dataIndex: 'status',
      width: 112,
      align: 'center',
      render: (value) => (
        <Tag color={value === 'OPEN' ? 'success' : 'default'}>{value}</Tag>
      ),
    },
    {
      title: '기간',
      key: 'dateRange',
      width: 190,
      align: 'center',
      render: (_, item) => item.dateStart && item.dateEnd
        ? `${formatDisplayDate(item.dateStart)} ~ ${formatDisplayDate(item.dateEnd)}`
        : '-',
    },
    {
      title: 'Abstract',
      dataIndex: 'activeAbstractCount',
      width: 92,
      align: 'right',
      render: (value) => formatNumberWithComma(value),
    },
    {
      title: '수정일',
      dataIndex: 'updatedAt',
      width: 150,
      align: 'center',
      render: formatDisplayDate,
    },
    {
      title: '작업',
      key: 'actions',
      width: 130,
      fixed: 'right',
      align: 'center',
      render: (_, item) => item.deletedAt ? (
        <Button
          size="small"
          icon={<RotateCcw size={14} />}
          loading={conferenceMutatingId === item.id}
          onClick={() => void restoreConference(item)}
        >
          복구
        </Button>
      ) : (
        <Space size={4}>
          <Button
            size="small"
            type="text"
            icon={<Pencil size={14} />}
            aria-label="Conference 수정"
            onClick={() => openConferenceForm(item)}
          />
          <Popconfirm
            title="Conference를 삭제하시겠습니까?"
            description={item.activeAbstractCount > 0
              ? `활성 Abstract ${formatNumberWithComma(item.activeAbstractCount)}건을 먼저 삭제해야 합니다.`
              : '삭제 후 삭제 목록에서 복구할 수 있습니다.'}
            okText="삭제"
            cancelText="취소"
            okButtonProps={{ danger: true, disabled: item.activeAbstractCount > 0 }}
            onConfirm={() => void deleteConference(item)}
          >
            <Button
              size="small"
              type="text"
              danger
              icon={<Trash2 size={14} />}
              aria-label="Conference 삭제"
              loading={conferenceMutatingId === item.id}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const abstractColumns: TableColumnsType<AdminConferenceAbstractItem> = [
    {
      title: 'Conference',
      key: 'conference',
      width: 135,
      align: 'center',
      render: (_, item) => (
        <Tag>{item.conference.abbreviation} {item.conference.year}</Tag>
      ),
    },
    {
      title: 'Abstract No.',
      dataIndex: 'abstractNumber',
      width: 130,
      align: 'center',
      render: (value) => value || '-',
    },
    { title: '제목', dataIndex: 'title', ellipsis: true },
    { title: '제1저자', dataIndex: 'firstAuthorName', width: 140, ellipsis: true, render: (value) => value || '-' },
    { title: '소속', dataIndex: 'firstAuthorOrganization', width: 180, ellipsis: true, render: (value) => value || '-' },
    {
      title: '공개일',
      dataIndex: 'dateOpen',
      width: 112,
      align: 'center',
      render: (value) => value ? formatDisplayDate(value) : '-',
    },
    {
      title: '수정일',
      dataIndex: 'updatedAt',
      width: 150,
      align: 'center',
      render: formatDisplayDate,
    },
    {
      title: '작업',
      key: 'actions',
      width: 166,
      fixed: 'right',
      align: 'center',
      render: (_, item) => item.deletedAt ? (
        <Button
          size="small"
          icon={<RotateCcw size={14} />}
          loading={abstractMutatingId === item.id}
          disabled={Boolean(item.conference.deletedAt)}
          onClick={() => void restoreAbstract(item)}
        >
          복구
        </Button>
      ) : (
        <Space size={4}>
          <Button
            size="small"
            type="text"
            icon={<ExternalLink size={14} />}
            aria-label="Abstract 상세"
            onClick={() => navigate(`/conferences/abstracts/${item.id}`)}
          />
          <Button
            size="small"
            type="text"
            icon={<Pencil size={14} />}
            aria-label="Abstract 수정"
            onClick={() => openAbstractForm(item)}
          />
          <Popconfirm
            title="Abstract를 삭제하시겠습니까?"
            description="삭제 후 삭제 목록에서 복구할 수 있습니다."
            okText="삭제"
            cancelText="취소"
            okButtonProps={{ danger: true }}
            onConfirm={() => void deleteAbstract(item)}
          >
            <Button
              size="small"
              type="text"
              danger
              icon={<Trash2 size={14} />}
              aria-label="Abstract 삭제"
              loading={abstractMutatingId === item.id}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (!canManageConference) return <Navigate to="/dashboard" replace />;

  const importTab = (
    <div className="conference-admin-import-tab">
      {batches.length === 0 && (
        <Alert
          type="warning"
          showIcon
          message="사용 가능한 import batch가 없습니다."
          description="아래에서 Legacy 또는 API metadata 파일을 새 batch로 업로드해 주세요."
        />
      )}
      <Card className="c-card" title={<Space><UploadCloud size={17} />Import batch 업로드</Space>}>
        <Space wrap size={12} style={{ marginBottom: 12 }}>
          <Input
            value={uploadBatchKey}
            onChange={(event) => setUploadBatchKey(event.target.value)}
            placeholder="Batch key (예: legacy-20260727)"
            maxLength={100}
            style={{ width: 260 }}
          />
          <Select
            value={uploadBatchKind}
            onChange={setUploadBatchKind}
            style={{ width: 180 }}
            options={[
              { value: 'LEGACY', label: 'Legacy metadata' },
              { value: 'API_METADATA', label: 'API metadata' },
            ]}
          />
          <Button
            type="primary"
            icon={<UploadCloud size={16} />}
            loading={uploadingBatch}
            disabled={!uploadBatchKey.trim() || uploadFiles.length === 0}
            onClick={() => void uploadImportBatch()}
          >
            Batch 업로드
          </Button>
        </Space>
        <Upload.Dragger
          multiple
          accept=".xlsx,.json"
          maxCount={50}
          fileList={uploadFiles}
          beforeUpload={() => false}
          onChange={({ fileList }) => setUploadFiles(fileList)}
          disabled={uploadingBatch}
        >
          <p className="ant-upload-drag-icon"><UploadCloud size={32} /></p>
          <p className="ant-upload-text">Excel과 JSON 파일을 끌어놓거나 선택하세요.</p>
          <p className="ant-upload-hint">
            Legacy는 conference_list.json 1개와 Excel이 필요합니다. API metadata는
            Excel만 업로드합니다. 파일당 최대 25MB, batch당 최대 200MB입니다.
          </p>
        </Upload.Dragger>
      </Card>
      <Card className="c-card">
        <Space wrap size={12}>
          <Select
            value={selectedBatch}
            onChange={setSelectedBatch}
            placeholder="Batch 선택"
            style={{ width: 220 }}
            options={batches.map((batch) => ({
              value: batch.batchKey,
              label: `${batch.batchKey} (${batch.excelCount} Excel · ${
                batch.source === 'ADMIN_UPLOAD' ? '업로드' : '서버 파일'
              })`,
            }))}
          />
          <Input
            value={profileVersion}
            onChange={(event) => setProfileVersion(event.target.value)}
            placeholder="Profile version"
            style={{ width: 140 }}
          />
          <Button
            icon={<SearchCheck size={16} />}
            loading={startingMode === 'DRY_RUN'}
            disabled={!selectedBatch || !profileVersion.trim()}
            onClick={() => void startImport('DRY_RUN')}
          >
            Dry-run
          </Button>
          <Popconfirm
            title={profileVersion === 'legacy-comments/v1'
              ? '기존 댓글 import를 실행하시겠습니까?'
              : 'Metadata import를 실행하시겠습니까?'}
            description={profileVersion === 'legacy-comments/v1'
              ? 'list_dict_comment의 기존 댓글만 반영하며 과거 알림 메일은 생성하지 않습니다.'
              : '선택한 batch의 Conference/Abstract metadata가 개발 DB에 upsert됩니다.'}
            okText="APPLY"
            cancelText="취소"
            disabled={!successfulDryRun}
            onConfirm={() => void startImport('APPLY')}
          >
            <Button
              type="primary"
              danger
              icon={<PlayCircle size={16} />}
              loading={startingMode === 'APPLY'}
              disabled={!successfulDryRun}
            >
              APPLY
            </Button>
          </Popconfirm>
          <Button icon={<RefreshCw size={15} />} loading={loading} onClick={() => void loadAdminData()}>
            새로고침
          </Button>
        </Space>
        <Alert
          style={{ marginTop: 14 }}
          type="info"
          showIcon
          message="APPLY는 동일 batch·profile의 오류 없는 Dry-run이 완료된 경우에만 활성화됩니다."
          description={profileVersion === 'legacy-comments/v1'
            ? 'legacy batch를 선택하고 이 profile을 사용하면 기존 댓글만 멱등성 key로 이관합니다.'
            : 'Excel metadata와 legacy media URL만 DB에 반영하며 media binary는 복사하지 않습니다.'}
        />
      </Card>
      <div
        className="v-table-card conference-admin-import-list"
      >
        <div
          ref={importTable.tableRegionRef}
          className="conference-admin-import-table-region"
          style={importTable.tableRegionStyle}
        >
          <Table
            className="conference-admin-import-table viewport-fill-table"
            rowKey="id"
            size="small"
            columns={runColumns}
            dataSource={runs}
            loading={loading}
            scroll={{ x: 1100, y: importTable.tableBodyHeight }}
            pagination={{
              position: ['bottomRight'],
              pageSize: 10,
              showSizeChanger: true,
              pageSizeOptions: [10, 30, 50, 100],
              showTotal: undefined,
              itemRender: (page, type, originalElement) => (
                type === 'page'
                  ? <span>{formatNumberWithComma(page)}</span>
                  : originalElement
              ),
            }}
          />
        </div>
      </div>
    </div>
  );

  const conferenceTab = (
    <div className="conference-admin-management-tab">
      <Card className="c-card">
        <Space wrap size={8}>
          <Input.Search
            defaultValue={conferenceQuery.q}
            allowClear
            placeholder="Conference key, 약어, 정식 명칭"
            style={{ width: 280 }}
            onSearch={(q) => setConferenceQuery((current) => ({
              ...current,
              q: q.trim() || undefined,
              page: 1,
            }))}
          />
          <InputNumber
            min={2000}
            max={2100}
            placeholder="연도"
            value={conferenceQuery.year}
            onChange={(year) => setConferenceQuery((current) => ({
              ...current,
              year: year ?? undefined,
              page: 1,
            }))}
          />
          <Select
            allowClear
            placeholder="상태"
            style={{ width: 140 }}
            value={conferenceQuery.status}
            options={[
              { value: 'OPEN', label: 'OPEN' },
              { value: 'NOT_OPENED', label: 'NOT_OPENED' },
            ]}
            onChange={(status) => setConferenceQuery((current) => ({
              ...current,
              status,
              page: 1,
            }))}
          />
          <Select
            style={{ width: 120 }}
            value={conferenceQuery.deleted}
            options={[
              { value: 'active', label: '사용 중' },
              { value: 'deleted', label: '삭제됨' },
            ]}
            onChange={(deleted) => setConferenceQuery((current) => ({
              ...current,
              deleted,
              page: 1,
            }))}
          />
          <Select
            style={{ width: 140 }}
            value={conferenceQuery.sort}
            options={[
              { value: 'yearDesc', label: '연도 내림차순' },
              { value: 'yearAsc', label: '연도 오름차순' },
              { value: 'updatedDesc', label: '최근 수정순' },
            ]}
            onChange={(sort) => setConferenceQuery((current) => ({
              ...current,
              sort,
              page: 1,
            }))}
          />
          <Button
            icon={<RefreshCw size={15} />}
            loading={conferenceListLoading}
            onClick={() => void loadConferenceRows()}
          >
            새로고침
          </Button>
          <Button type="primary" icon={<Plus size={15} />} onClick={() => openConferenceForm()}>
            Conference 등록
          </Button>
        </Space>
      </Card>
      <div
        ref={conferenceManagementTable.tableRegionRef}
        className="v-table-card conference-admin-management-list"
        style={conferenceManagementTable.tableRegionStyle}
      >
        <div className="v-table-header">
          <Text strong>Conference 목록</Text>
          <Text type="secondary">{formatNumberWithComma(conferenceTotal)} conferences</Text>
        </div>
        <Table
          className="viewport-fill-table"
          rowKey="id"
          size="small"
          columns={conferenceColumns}
          dataSource={conferenceRows}
          loading={conferenceListLoading}
          scroll={{ x: 1250, y: conferenceManagementTable.tableBodyHeight }}
          pagination={{
            current: conferenceQuery.page,
            pageSize: conferenceQuery.pageSize,
            total: conferenceTotal,
            showSizeChanger: true,
            pageSizeOptions: [10, 30, 50, 100],
            showTotal: undefined,
            onChange: (page, pageSize) => setConferenceQuery((current) => ({
              ...current,
              page,
              pageSize,
            })),
          }}
          locale={{ emptyText: '조건에 맞는 Conference가 없습니다.' }}
        />
      </div>
    </div>
  );

  const recipientImportTab = (
    <div className="conference-admin-operations-tab">
      {recipientBatches.length === 0 && (
        <Alert
          type="warning"
          showIcon
          message="업로드된 메일 대상 batch가 없습니다."
          description="getMembers.json을 새 batch로 업로드한 뒤 Dry-run을 실행해 주세요."
        />
      )}
      <Card className="c-card" title={<Space><UploadCloud size={17} />메일 대상 batch 업로드</Space>}>
        <Space wrap size={12} style={{ marginBottom: 12 }}>
          <Input
            value={recipientUploadBatchKey}
            onChange={(event) => setRecipientUploadBatchKey(event.target.value)}
            placeholder="Batch key (예: groupware-members-20260727)"
            maxLength={100}
            style={{ width: 320 }}
          />
          <Button
            type="primary"
            icon={<UploadCloud size={16} />}
            loading={uploadingRecipientBatch}
            disabled={!recipientUploadBatchKey.trim() || recipientUploadFile.length === 0}
            onClick={() => void uploadRecipientBatch()}
          >
            Batch 업로드
          </Button>
        </Space>
        <Upload.Dragger
          accept=".json,application/json"
          maxCount={1}
          fileList={recipientUploadFile}
          beforeUpload={() => false}
          onChange={({ fileList }) => setRecipientUploadFile(fileList.slice(-1))}
          disabled={uploadingRecipientBatch}
        >
          <p className="ant-upload-drag-icon"><UploadCloud size={32} /></p>
          <p className="ant-upload-text">getMembers.json을 끌어놓거나 선택하세요.</p>
          <p className="ant-upload-hint">
            JSON 배열 형식의 파일 1개만 업로드할 수 있으며 최대 크기는 5MB입니다.
          </p>
        </Upload.Dragger>
      </Card>
      <Card className="c-card">
        <Space wrap size={12}>
          <Select
            value={selectedRecipientBatch}
            onChange={setSelectedRecipientBatch}
            placeholder="Batch 선택"
            style={{ width: 280 }}
            options={recipientBatches.map((batch) => ({
              value: batch.batchKey,
              label: `${batch.batchKey} (${batch.originalFilename})`,
            }))}
          />
          <Button
            icon={<SearchCheck size={16} />}
            loading={startingRecipientMode === 'DRY_RUN'}
            disabled={!selectedRecipientBatch}
            onClick={() => void startRecipientImport('DRY_RUN')}
          >
            사용자 이메일 Dry-run
          </Button>
          <Popconfirm
            title="사용자 이메일 정보를 이관하시겠습니까?"
            description="이메일이 있는 구성원만 알림 대상 DB에 upsert됩니다."
            okText="APPLY"
            cancelText="취소"
            disabled={!selectedRecipientBatch || !successfulRecipientDryRun}
            onConfirm={() => void startRecipientImport('APPLY')}
          >
            <Button
              type="primary"
              danger
              icon={<PlayCircle size={16} />}
              loading={startingRecipientMode === 'APPLY'}
              disabled={!selectedRecipientBatch || !successfulRecipientDryRun}
            >
              APPLY
            </Button>
          </Popconfirm>
          <Button
            icon={<RefreshCw size={15} />}
            loading={startingRecipientMode === 'RECONCILE'}
            onClick={() => void reconcileRecipientUsers()}
          >
            User 연결 동기화
          </Button>
          <Button
            icon={<RefreshCw size={15} />}
            loading={loading}
            onClick={() => void loadAdminData()}
          >
            새로고침
          </Button>
        </Space>
        <Alert
          style={{ marginTop: 14 }}
          type="info"
          showIcon
          message="선택한 getMembers.json batch의 member_id, 이름, 이메일을 알림 대상 DB에 저장합니다."
          description="APPLY는 같은 batch checksum의 오류·충돌 없는 Dry-run 후에만 활성화됩니다. 이메일이 없는 구성원은 SKIPPED_NO_EMAIL로 제외하며 인증 User는 생성하지 않습니다."
        />
      </Card>
      <div
        className="v-table-card conference-admin-operations-list"
        ref={recipientTable.tableRegionRef}
        style={recipientTable.tableRegionStyle}
      >
        <Table
          className="viewport-fill-table"
          rowKey="id"
          size="small"
          columns={recipientRunColumns}
          dataSource={recipientRuns}
          loading={loading}
          scroll={{ x: 1300, y: recipientTable.tableBodyHeight }}
          pagination={{
            position: ['bottomRight'],
            pageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: [10, 30, 50, 100],
            showTotal: undefined,
            itemRender: (page, type, originalElement) => (
              type === 'page'
                ? <span>{formatNumberWithComma(page)}</span>
                : originalElement
            ),
          }}
        />
      </div>
    </div>
  );

  const mailOutboxTab = (
    <div className="conference-admin-operations-tab">
      <Card className="c-card">
        <Alert
          type={mailHealth?.provider.ready ? 'success' : 'warning'}
          showIcon
          message={mailHealth?.provider.ready
            ? 'Gmail provider가 발송 가능한 상태입니다.'
            : 'Gmail provider 설정을 확인해 주세요.'}
          description={mailHealth?.provider.errorCode || (
            `대기 ${formatNumberWithComma(mailHealth?.counts.PENDING ?? 0)}건 · `
            + `재시도 ${formatNumberWithComma(mailHealth?.counts.RETRY ?? 0)}건 · `
            + `실패 ${formatNumberWithComma(mailHealth?.counts.FAILED ?? 0)}건 · `
            + `완료 ${formatNumberWithComma(mailHealth?.counts.SENT ?? 0)}건`
          )}
        />
        <Button
          style={{ marginTop: 12 }}
          icon={<RefreshCw size={15} />}
          loading={loading}
          onClick={() => void loadAdminData()}
        >
          새로고침
        </Button>
      </Card>
      <div
        className="v-table-card conference-admin-operations-list"
        ref={mailTable.tableRegionRef}
        style={mailTable.tableRegionStyle}
      >
        <Table
          className="viewport-fill-table"
          rowKey="id"
          size="small"
          columns={mailOutboxColumns}
          dataSource={mailOutboxes}
          loading={loading}
          scroll={{ x: 1150, y: mailTable.tableBodyHeight }}
          pagination={{
            position: ['bottomRight'],
            pageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: [10, 30, 50, 100],
            showTotal: undefined,
            itemRender: (page, type, originalElement) => (
              type === 'page'
                ? <span>{formatNumberWithComma(page)}</span>
                : originalElement
            ),
          }}
        />
      </div>
    </div>
  );

  const abstractTab = (
    <div className="conference-admin-management-tab">
      <Card className="c-card">
        <Space wrap size={8}>
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Conference"
            style={{ width: 220 }}
            value={abstractQuery.conferenceId}
            options={conferences.map((conference) => ({
              value: conference.id,
              label: `${conference.abbreviation} ${conference.year}`,
            }))}
            onChange={(conferenceId) => setAbstractQuery((current) => ({
              ...current,
              conferenceId,
              page: 1,
            }))}
          />
          <Input.Search
            defaultValue={abstractQuery.q}
            allowClear
            placeholder="번호, 제목, 저자, 세션"
            style={{ width: 280 }}
            onSearch={(q) => setAbstractQuery((current) => ({
              ...current,
              q: q.trim() || undefined,
              page: 1,
            }))}
          />
          <DatePicker.RangePicker
            format="YYYY.MM.DD"
            onChange={(range) => setAbstractQuery((current) => ({
              ...current,
              dateFrom: range?.[0]?.format('YYYY-MM-DD'),
              dateTo: range?.[1]?.format('YYYY-MM-DD'),
              page: 1,
            }))}
          />
          <Select
            style={{ width: 120 }}
            value={abstractQuery.deleted}
            options={[
              { value: 'active', label: '사용 중' },
              { value: 'deleted', label: '삭제됨' },
            ]}
            onChange={(deleted) => setAbstractQuery((current) => ({
              ...current,
              deleted,
              page: 1,
            }))}
          />
          <Select
            style={{ width: 150 }}
            value={abstractQuery.sort}
            options={[
              { value: 'updatedDesc', label: '최근 수정순' },
              { value: 'abstractNumberAsc', label: 'Abstract No.순' },
              { value: 'dateOpenDesc', label: '공개일 내림차순' },
            ]}
            onChange={(sort) => setAbstractQuery((current) => ({
              ...current,
              sort,
              page: 1,
            }))}
          />
          <Button
            icon={<RefreshCw size={15} />}
            loading={abstractListLoading}
            onClick={() => void loadAbstractRows()}
          >
            새로고침
          </Button>
          <Button type="primary" icon={<Plus size={15} />} onClick={() => openAbstractForm()}>
            Abstract 등록
          </Button>
        </Space>
      </Card>
      <div
        ref={abstractManagementTable.tableRegionRef}
        className="v-table-card conference-admin-management-list"
        style={abstractManagementTable.tableRegionStyle}
      >
        <div className="v-table-header">
          <Text strong>Abstract 목록</Text>
          <Text type="secondary">{formatNumberWithComma(abstractTotal)} abstracts</Text>
        </div>
        <Table
          className="viewport-fill-table"
          rowKey="id"
          size="small"
          columns={abstractColumns}
          dataSource={abstractRows}
          loading={abstractListLoading}
          scroll={{ x: 1300, y: abstractManagementTable.tableBodyHeight }}
          pagination={{
            current: abstractQuery.page,
            pageSize: abstractQuery.pageSize,
            total: abstractTotal,
            showSizeChanger: true,
            pageSizeOptions: [10, 30, 50, 100],
            showTotal: undefined,
            onChange: (page, pageSize) => setAbstractQuery((current) => ({
              ...current,
              page,
              pageSize,
            })),
          }}
          locale={{ emptyText: '조건에 맞는 Abstract가 없습니다.' }}
        />
      </div>
    </div>
  );

  return (
    <div className={`conference-admin-page conference-admin-page-${activeTabKey}`}>
      <Tabs
        activeKey={activeTabKey}
        onChange={setActiveTabKey}
        items={[
          { key: 'conference', label: 'Conference 관리', children: conferenceTab },
          { key: 'abstract', label: 'Abstract 관리', children: abstractTab },
          {
            key: 'import',
            label: (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 20, lineHeight: '20px' }}>
                <FileSpreadsheet size={15} style={{ display: 'block', flexShrink: 0 }} />
                <span>Import</span>
              </span>
            ),
            children: importTab,
          },
          {
            key: 'recipients',
            label: (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 20, lineHeight: '20px' }}>
                <UsersRound size={15} style={{ display: 'block', flexShrink: 0 }} />
                <span>메일 대상</span>
              </span>
            ),
            children: recipientImportTab,
          },
          {
            key: 'mail-outbox',
            label: (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 20, lineHeight: '20px' }}>
                <Mail size={15} style={{ display: 'block', flexShrink: 0 }} />
                <span>메일 발송</span>
              </span>
            ),
            children: mailOutboxTab,
          },
        ]}
      />

      <Modal
        rootClassName="conference-admin-modal"
        width={760}
        title={editingConference ? 'Conference 수정' : 'Conference 등록'}
        open={conferenceModalOpen}
        okText={editingConference ? '수정' : '등록'}
        cancelText="취소"
        confirmLoading={savingConference}
        onOk={() => void saveConference()}
        onCancel={() => {
          setConferenceModalOpen(false);
          setEditingConference(null);
          conferenceForm.resetFields();
        }}
      >
        <Form form={conferenceForm} layout="vertical">
          <div className="conference-admin-form-grid">
            <Form.Item name="title" label="Conference key" rules={[{ required: true }]}>
              <Input placeholder="예: ESMO_2027" />
            </Form.Item>
            <Form.Item name="abbreviation" label="약어" rules={[{ required: true }]}>
              <Input placeholder="예: ESMO" />
            </Form.Item>
            <Form.Item name="year" label="연도" rules={[{ required: true }]}>
              <InputNumber min={2000} max={2100} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="status" label="상태" rules={[{ required: true }]}>
              <Select options={[
                { value: 'OPEN', label: 'OPEN' },
                { value: 'NOT_OPENED', label: 'NOT_OPENED' },
              ]} />
            </Form.Item>
            <Form.Item name="fullTitle" label="정식 명칭" className="conference-admin-span-2">
              <Input />
            </Form.Item>
            <Form.Item name="dateRange" label="개최 기간">
              <DatePicker.RangePicker style={{ width: '100%' }} format="YYYY.MM.DD" />
            </Form.Item>
            <Form.Item name="sourceUrl" label="원본 URL">
              <Input />
            </Form.Item>
          </div>
        </Form>
      </Modal>

      <Modal
        rootClassName="conference-admin-modal"
        width={900}
        title={editingAbstract ? 'Abstract 수정' : 'Abstract 등록'}
        open={abstractModalOpen}
        okText={editingAbstract ? '수정' : '등록'}
        cancelText="취소"
        confirmLoading={savingAbstract}
        onOk={() => void saveAbstract()}
        onCancel={() => {
          setAbstractModalOpen(false);
          setEditingAbstract(null);
          abstractForm.resetFields();
        }}
      >
        <Form form={abstractForm} layout="vertical">
          <div className="conference-admin-form-grid">
            <Form.Item name="conferenceId" label="Conference" rules={[{ required: true }]}>
              <Select
                showSearch
                optionFilterProp="label"
                options={conferences.map((conference) => ({
                  value: conference.id,
                  label: `${conference.abbreviation} ${conference.year}`,
                }))}
              />
            </Form.Item>
            <Form.Item name="abstractNumber" label="Abstract No.">
              <Input />
            </Form.Item>
            <Form.Item name="title" label="제목" rules={[{ required: true }]} className="conference-admin-span-2">
              <Input />
            </Form.Item>
            <Form.Item name="firstAuthorName" label="제1저자">
              <Input />
            </Form.Item>
            <Form.Item name="firstAuthorOrganization" label="제1저자 소속">
              <Input />
            </Form.Item>
            <Form.Item name="authorsText" label="전체 저자 (comma 구분)" className="conference-admin-span-2">
              <Input />
            </Form.Item>
            <Form.Item name="meeting" label="Meeting"><Input /></Form.Item>
            <Form.Item name="sessionType" label="Session type"><Input /></Form.Item>
            <Form.Item name="sessionTitle" label="Session title" className="conference-admin-span-2"><Input /></Form.Item>
            <Form.Item name="track" label="Track"><Input /></Form.Item>
            <Form.Item name="subTrack" label="Sub-track"><Input /></Form.Item>
            <Form.Item name="posterNumber" label="Poster No."><Input /></Form.Item>
            <Form.Item name="clinicalTrialRegistrationNumber" label="임상시험 번호"><Input /></Form.Item>
            <Form.Item name="dateOpen" label="공개일"><DatePicker style={{ width: '100%' }} format="YYYY.MM.DD" /></Form.Item>
            <Form.Item name="sourceUrl" label="원본 URL"><Input /></Form.Item>
            <Form.Item name="contentsJson" label="본문 JSON 또는 text" className="conference-admin-span-2">
              <Input.TextArea rows={8} />
            </Form.Item>
          </div>
        </Form>
      </Modal>

      <Modal
        rootClassName="conference-admin-modal"
        width={1100}
        title="Conference import 상세"
        open={Boolean(selectedRun)}
        footer={<Button onClick={() => setSelectedRun(null)}>닫기</Button>}
        onCancel={() => setSelectedRun(null)}
      >
        {selectedRun && (
          <>
            <Descriptions size="small" column={3}>
              <Descriptions.Item label="Batch">{selectedRun.batchKey}</Descriptions.Item>
              <Descriptions.Item label="Mode">{selectedRun.mode}</Descriptions.Item>
              <Descriptions.Item label="상태">{selectedRun.status}</Descriptions.Item>
              <Descriptions.Item label="등록">{formatNumberWithComma(selectedRun.insertedCount)}</Descriptions.Item>
              <Descriptions.Item label="수정">{formatNumberWithComma(selectedRun.updatedCount)}</Descriptions.Item>
              <Descriptions.Item label={selectedRun.mode === 'DRY_RUN' ? '검사 행' : 'Skip'}>
                {formatNumberWithComma(
                  selectedRun.mode === 'DRY_RUN'
                    ? selectedRun.inspectedCount ?? 0
                    : selectedRun.skippedCount,
                )}
              </Descriptions.Item>
              <Descriptions.Item label="오류">{formatNumberWithComma(selectedRun.errorCount)}</Descriptions.Item>
            </Descriptions>
            <Table
              style={{ marginTop: 16 }}
              rowKey="id"
              size="small"
              columns={issueColumns}
              dataSource={selectedRun.issues ?? []}
              scroll={{ x: 900 }}
              pagination={{ pageSize: 10 }}
              locale={{ emptyText: '기록된 issue가 없습니다.' }}
            />
          </>
        )}
      </Modal>

      <Modal
        rootClassName="conference-admin-modal"
        width={1000}
        title="사용자 이메일 이관 상세"
        open={Boolean(selectedRecipientRun)}
        footer={<Button onClick={() => setSelectedRecipientRun(null)}>닫기</Button>}
        onCancel={() => setSelectedRecipientRun(null)}
      >
        {selectedRecipientRun && (
          <>
            <Descriptions size="small" column={4}>
              <Descriptions.Item label="Batch">
                {selectedRecipientRun.batch?.batchKey ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Version">
                {selectedRecipientRun.profileVersion}
              </Descriptions.Item>
              <Descriptions.Item label="Mode">
                {selectedRecipientRun.mode}
              </Descriptions.Item>
              <Descriptions.Item label="상태">
                {selectedRecipientRun.status}
              </Descriptions.Item>
              <Descriptions.Item label="원본">
                {formatNumberWithComma(selectedRecipientRun.sourceCount)}
              </Descriptions.Item>
              <Descriptions.Item label="등록">
                {formatNumberWithComma(selectedRecipientRun.insertedCount)}
              </Descriptions.Item>
              <Descriptions.Item label="수정">
                {formatNumberWithComma(selectedRecipientRun.updatedCount)}
              </Descriptions.Item>
              <Descriptions.Item label="동일">
                {formatNumberWithComma(selectedRecipientRun.unchangedCount)}
              </Descriptions.Item>
              <Descriptions.Item label="제외">
                {formatNumberWithComma(selectedRecipientRun.skippedCount)}
              </Descriptions.Item>
              <Descriptions.Item label="충돌/오류">
                {formatNumberWithComma(
                  selectedRecipientRun.conflictCount
                  + selectedRecipientRun.errorCount,
                )}
              </Descriptions.Item>
            </Descriptions>
            <Table
              style={{ marginTop: 16 }}
              rowKey="id"
              size="small"
              columns={recipientIssueColumns}
              dataSource={selectedRecipientRun.issues ?? []}
              scroll={{ x: 800 }}
              pagination={{ pageSize: 10 }}
              locale={{ emptyText: '기록된 issue가 없습니다.' }}
            />
          </>
        )}
      </Modal>

      <style>{`
        .conference-admin-page {
          height: 100%;
          overflow: auto;
          box-sizing: border-box;
          padding: 0 16px 16px;
        }
        .conference-admin-page-import > .ant-tabs,
        .conference-admin-page-recipients > .ant-tabs,
        .conference-admin-page-mail-outbox > .ant-tabs,
        .conference-admin-page-conference > .ant-tabs,
        .conference-admin-page-abstract > .ant-tabs {
          height: 100%;
          display: flex;
          flex-direction: column;
        }
        .conference-admin-page-import > .ant-tabs > .ant-tabs-nav,
        .conference-admin-page-recipients > .ant-tabs > .ant-tabs-nav,
        .conference-admin-page-mail-outbox > .ant-tabs > .ant-tabs-nav,
        .conference-admin-page-conference > .ant-tabs > .ant-tabs-nav,
        .conference-admin-page-abstract > .ant-tabs > .ant-tabs-nav {
          flex: 0 0 auto;
        }
        .conference-admin-page-import > .ant-tabs > .ant-tabs-content-holder,
        .conference-admin-page-recipients > .ant-tabs > .ant-tabs-content-holder,
        .conference-admin-page-mail-outbox > .ant-tabs > .ant-tabs-content-holder,
        .conference-admin-page-conference > .ant-tabs > .ant-tabs-content-holder,
        .conference-admin-page-abstract > .ant-tabs > .ant-tabs-content-holder {
          flex: 1 1 auto;
          min-height: 0;
          overflow: visible;
        }
        .conference-admin-page-import .ant-tabs-content,
        .conference-admin-page-import .ant-tabs-tabpane-active,
        .conference-admin-page-recipients .ant-tabs-content,
        .conference-admin-page-recipients .ant-tabs-tabpane-active,
        .conference-admin-page-mail-outbox .ant-tabs-content,
        .conference-admin-page-mail-outbox .ant-tabs-tabpane-active,
        .conference-admin-page-conference .ant-tabs-content,
        .conference-admin-page-conference .ant-tabs-tabpane-active,
        .conference-admin-page-abstract .ant-tabs-content,
        .conference-admin-page-abstract .ant-tabs-tabpane-active {
          height: 100%;
          min-height: 0;
        }
        .conference-admin-import-tab {
          height: 100%;
          min-height: 0;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .conference-admin-import-tab > .ant-alert,
        .conference-admin-import-tab > .ant-card {
          flex: 0 0 auto;
        }
        .conference-admin-import-list {
          flex: 1 1 auto;
          min-height: 210px;
          overflow: hidden;
        }
        .conference-admin-import-table-region {
          height: 100%;
          min-height: 0;
          overflow: hidden;
          box-sizing: border-box;
        }
        .conference-admin-import-table .ant-pagination {
          margin: 12px 16px !important;
        }
        .conference-admin-operations-tab {
          height: 100%;
          min-height: 0;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .conference-admin-operations-tab > .ant-alert,
        .conference-admin-operations-tab > .ant-card {
          flex: 0 0 auto;
        }
        .conference-admin-operations-list {
          flex: 1 1 auto;
          min-height: 210px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .conference-admin-operations-list > .ant-table-wrapper {
          flex: 1 1 auto;
          min-height: 0;
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
        }
        .conference-admin-operations-list > .ant-table-wrapper > .ant-spin-nested-loading {
          flex: 1 1 auto;
          min-height: 0;
          display: flex;
          flex-direction: column;
        }
        .conference-admin-operations-list .ant-spin-container {
          flex: 1 1 auto;
          min-height: 0;
          display: flex;
          flex-direction: column;
        }
        .conference-admin-operations-list .ant-pagination {
          flex: 0 0 auto;
          margin: auto 16px 12px !important;
        }
        .conference-admin-management-tab {
          height: 100%;
          display: flex;
          flex-direction: column;
          gap: 12px;
          min-height: 0;
        }
        .conference-admin-management-list {
          flex: 1 1 auto;
          min-height: 0;
          overflow: hidden;
        }
        .conference-admin-management-list .ant-pagination {
          margin: 12px 16px !important;
        }
        .conference-admin-form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0 16px;
        }
        .conference-admin-span-2 {
          grid-column: 1 / -1;
        }
        @media (max-width: 800px) {
          .conference-admin-form-grid {
            grid-template-columns: 1fr;
          }
          .conference-admin-span-2 {
            grid-column: auto;
          }
        }
      `}</style>
    </div>
  );
};

export default ConferenceAdmin;
