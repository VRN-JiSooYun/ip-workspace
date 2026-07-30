import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
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
import type { Dayjs } from 'dayjs';
import {
  Database,
  FileSpreadsheet,
  Mail,
  PlayCircle,
  Plus,
  RefreshCw,
  SearchCheck,
  UploadCloud,
  UsersRound,
} from 'lucide-react';
import PageHeaderBreadcrumb from '../components/common/PageHeaderBreadcrumb';
import { useAuthSession } from '../contexts/AuthSessionContext';
import {
  conferenceAdminApi,
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

const { Paragraph, Text, Title } = Typography;

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
  const session = useAuthSession();
  const { message } = App.useApp();
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
  const [activeTabKey, setActiveTabKey] = useState('import');
  const importTable = useViewportTableHeight({ enabled: activeTabKey === 'import' });
  const recipientTable = useViewportTableHeight({ enabled: activeTabKey === 'recipients' });
  const mailTable = useViewportTableHeight({ enabled: activeTabKey === 'mail-outbox' });
  const isAdmin = session.user.role === 'ADMIN';

  useEffect(() => {
    setHeaderContent(
      <PageHeaderBreadcrumb
        items={[
          { label: 'Workspace' },
          { label: 'Conference 관리' },
        ]}
      />,
    );
    return () => setHeaderContent(null);
  }, [setHeaderContent]);

  const loadAdminData = useCallback(async () => {
    if (!isAdmin) return;
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
  }, [isAdmin, message]);

  useEffect(() => {
    void loadAdminData();
  }, [loadAdminData]);

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
      await conferenceAdminApi.createConference({
        title: values.title.trim(),
        abbreviation: values.abbreviation.trim(),
        fullTitle: values.fullTitle?.trim(),
        year: values.year,
        status: values.status,
        sourceUrl: values.sourceUrl?.trim(),
        dateStart: values.dateRange?.[0].format('YYYY-MM-DD'),
        dateEnd: values.dateRange?.[1].format('YYYY-MM-DD'),
      });
      conferenceForm.resetFields();
      conferenceForm.setFieldValue('status', 'OPEN');
      void message.success('Conference를 등록했습니다.');
      await loadAdminData();
    } catch (error) {
      void message.error(error instanceof Error ? error.message : 'Conference 등록에 실패했습니다.');
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
      await conferenceAdminApi.createAbstract(values.conferenceId, {
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
      });
      abstractForm.resetFields();
      void message.success('Abstract를 등록했습니다.');
    } catch (error) {
      void message.error(error instanceof Error ? error.message : 'Abstract 등록에 실패했습니다.');
    } finally {
      setSavingAbstract(false);
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

  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  const importTab = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {batches.length === 0 && (
        <Alert
          type="warning"
          showIcon
          message="사용 가능한 import batch가 없습니다."
          description="아래에서 Legacy 또는 API metadata 파일을 새 batch로 업로드해 주세요."
        />
      )}
      <Card title={<Space><UploadCloud size={17} />Import batch 업로드</Space>}>
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
      <Card>
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
      <div className="v-table-card" ref={importTable.tableRegionRef} style={importTable.tableRegionStyle}>
        <Table
          className="viewport-fill-table"
          rowKey="id"
          size="small"
          columns={runColumns}
          dataSource={runs}
          loading={loading}
          scroll={{ x: 1100, y: importTable.tableBodyHeight }}
          pagination={{ pageSize: 10, showSizeChanger: true, pageSizeOptions: [10, 30, 50, 100] }}
        />
      </div>
    </div>
  );

  const conferenceTab = (
    <Card title={<Space><Plus size={17} />Conference 소량 등록</Space>}>
      <Form
        form={conferenceForm}
        layout="vertical"
        initialValues={{ status: 'OPEN' }}
      >
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
        <Button type="primary" loading={savingConference} onClick={() => void saveConference()}>
          Conference 등록
        </Button>
      </Form>
    </Card>
  );

  const recipientImportTab = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {recipientBatches.length === 0 && (
        <Alert
          type="warning"
          showIcon
          message="업로드된 메일 대상 batch가 없습니다."
          description="getMembers.json을 새 batch로 업로드한 뒤 Dry-run을 실행해 주세요."
        />
      )}
      <Card title={<Space><UploadCloud size={17} />메일 대상 batch 업로드</Space>}>
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
      <Card>
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
      <div className="v-table-card" ref={recipientTable.tableRegionRef} style={recipientTable.tableRegionStyle}>
        <Table
          className="viewport-fill-table"
          rowKey="id"
          size="small"
          columns={recipientRunColumns}
          dataSource={recipientRuns}
          loading={loading}
          scroll={{ x: 1300, y: recipientTable.tableBodyHeight }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: [10, 30, 50, 100],
          }}
        />
      </div>
    </div>
  );

  const mailOutboxTab = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Card>
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
      <div className="v-table-card" ref={mailTable.tableRegionRef} style={mailTable.tableRegionStyle}>
        <Table
          className="viewport-fill-table"
          rowKey="id"
          size="small"
          columns={mailOutboxColumns}
          dataSource={mailOutboxes}
          loading={loading}
          scroll={{ x: 1150, y: mailTable.tableBodyHeight }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: [10, 30, 50, 100],
          }}
        />
      </div>
    </div>
  );

  const abstractTab = (
    <Card title={<Space><Plus size={17} />Abstract 소량 등록</Space>}>
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
        <Button type="primary" loading={savingAbstract} onClick={() => void saveAbstract()}>
          Abstract 등록
        </Button>
      </Form>
    </Card>
  );

  return (
    <div className="conference-admin-page">
      <div className="conference-admin-heading">
        <Space>
          <Database size={20} color="#F87C63" />
          <Title level={4}>Conference 관리</Title>
        </Space>
        <Paragraph type="secondary">Metadata import와 신규 Conference/Abstract를 관리합니다.</Paragraph>
      </div>
      <Tabs
        activeKey={activeTabKey}
        onChange={setActiveTabKey}
        items={[
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
          { key: 'conference', label: 'Conference 등록', children: conferenceTab },
          { key: 'abstract', label: 'Abstract 등록', children: abstractTab },
        ]}
      />

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
          padding: 0 8px 20px;
        }
        .conference-admin-heading .ant-typography {
          margin: 0;
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
