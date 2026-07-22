import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Descriptions, Modal, Space, Spin, Tabs, Tag, Typography } from 'antd';
import type { Compound } from '../../mocks/compounds';
import {
  calculationApi,
  type QuantumCalculationJob,
  type QuantumJobStatus,
  type QuantumJobType,
} from '../../services/calculationApi';
import { formatDisplayDate, formatNumberWithComma } from '../../utils/displayFormat';

const { Text } = Typography;

type QuantumCalculationDataModalProps = {
  compound: Compound | null;
  onClose: () => void;
  onJobsUpdated: (compoundId: string, jobs: QuantumCalculationJob[]) => void;
};

const STATUS_META: Record<QuantumJobStatus, { label: string; color: string }> = {
  SUBMITTING: { label: '요청 중', color: 'processing' },
  QUEUED: { label: '계산 대기', color: 'processing' },
  COMPLETED: { label: '완료', color: 'success' },
  FAILED: { label: '실패', color: 'error' },
};

const TYPE_LABELS: Record<QuantumJobType, string> = {
  PSA: '3D PSA QM',
  ESOL: 'E-Sol QM',
};

const getResultValue = (job: QuantumCalculationJob): unknown => job.resultData?.value;

const renderResultValue = (value: unknown): React.ReactNode => {
  if (typeof value === 'number') return formatNumberWithComma(value);
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return (
      <Space direction="vertical" size={2}>
        {value.map((item, index) => <Text key={index}>{String(item)}</Text>)}
      </Space>
    );
  }
  if (value && typeof value === 'object') {
    return (
      <Space direction="vertical" size={2}>
        {Object.entries(value as Record<string, unknown>).map(([key, item]) => (
          <Text key={key}><Text strong>{key}: </Text>{String(item)}</Text>
        ))}
      </Space>
    );
  }
  return '-';
};

const QuantumCalculationDataModal: React.FC<QuantumCalculationDataModalProps> = ({
  compound,
  onClose,
  onJobsUpdated,
}) => {
  const initialJobs = useMemo(() => [
    compound?.quantumCalculations?.psa,
    compound?.quantumCalculations?.esol,
  ].filter((job): job is QuantumCalculationJob => Boolean(job)), [compound]);
  const [jobs, setJobs] = useState<QuantumCalculationJob[]>(initialJobs);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState('');
  const openedCompoundIdRef = useRef<string | null>(null);

  useEffect(() => {
    setJobs(initialJobs);
    setRefreshError('');
  }, [initialJobs]);

  const refresh = useCallback(async (
    targetCompound: Compound,
    targetJobs: QuantumCalculationJob[],
  ) => {
    if (targetJobs.length === 0) return;
    setIsRefreshing(true);
    setRefreshError('');
    try {
      const refreshedJobs = await Promise.all(
        targetJobs.map((job) => calculationApi.getQuantumJob(job.id)),
      );
      setJobs(refreshedJobs);
      onJobsUpdated(targetCompound.id, refreshedJobs);
    } catch (error) {
      setRefreshError(error instanceof Error ? error.message : '계산 상태를 불러오지 못했습니다.');
    } finally {
      setIsRefreshing(false);
    }
  }, [onJobsUpdated]);

  useEffect(() => {
    if (!compound) {
      openedCompoundIdRef.current = null;
      return;
    }
    if (openedCompoundIdRef.current === compound.id) return;
    openedCompoundIdRef.current = compound.id;
    void refresh(compound, initialJobs);
  }, [compound, initialJobs, refresh]);

  const hasPendingJob = jobs.some((job) => job.status === 'SUBMITTING' || job.status === 'QUEUED');

  useEffect(() => {
    if (!compound || !hasPendingJob) return undefined;
    const timeoutId = window.setTimeout(() => void refresh(compound, jobs), 10000);
    return () => window.clearTimeout(timeoutId);
  }, [compound, hasPendingJob, jobs, refresh]);

  const tabItems = jobs.map((job) => {
    const statusMeta = STATUS_META[job.status];
    return {
      key: job.jobType,
      label: TYPE_LABELS[job.jobType],
      children: (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Descriptions
            size="small"
            bordered
            column={2}
            items={[
              {
                key: 'status',
                label: '상태',
                children: <Tag color={statusMeta.color}>{statusMeta.label}</Tag>,
              },
              {
                key: 'requestedAt',
                label: '요청 일시',
                children: formatDisplayDate(job.requestedAt),
              },
              {
                key: 'completedAt',
                label: '완료 일시',
                children: job.completedAt ? formatDisplayDate(job.completedAt) : '-',
              },
              {
                key: 'result',
                label: '결과',
                children: job.status === 'COMPLETED' ? renderResultValue(getResultValue(job)) : '-',
              },
              {
                key: 'smiles',
                label: 'SMILES',
                span: 2,
                children: <Text copyable={{ text: job.smiles }}>{job.smiles}</Text>,
              },
            ]}
          />
          {job.status === 'FAILED' ? (
            <Alert type="error" showIcon message="계산 실패" description={job.errorMessage || '계산에 실패했습니다.'} />
          ) : null}
        </Space>
      ),
    };
  });

  return (
    <Modal
      title="3D PSA·E-Sol 데이터"
      open={Boolean(compound && jobs.length > 0)}
      onCancel={onClose}
      footer={null}
      width={760}
      destroyOnHidden
    >
      {compound ? (
        <Spin spinning={isRefreshing} tip="계산 상태 확인 중">
          <Space direction="vertical" size={12} style={{ width: '100%', marginTop: 8 }}>
            <Descriptions
              size="small"
              bordered
              column={1}
              items={[
                {
                  key: 'ideaNumber',
                  label: '아이디어 번호',
                  children: compound.designNo || compound.name || '-',
                },
              ]}
            />
            {refreshError ? <Alert type="warning" showIcon message={refreshError} /> : null}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                size="small"
                loading={isRefreshing}
                onClick={() => void refresh(compound, jobs)}
              >
                최신 상태 새로고침
              </Button>
            </div>
            <Tabs items={tabItems} />
          </Space>
        </Spin>
      ) : null}
    </Modal>
  );
};

export default QuantumCalculationDataModal;
