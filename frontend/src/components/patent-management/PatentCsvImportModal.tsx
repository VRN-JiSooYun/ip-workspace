import React, { useState } from 'react';
import {
  Alert,
  App as AntApp,
  Button,
  Descriptions,
  Modal,
  Radio,
  Table,
  Tag,
  Typography,
  Upload,
} from 'antd';
import type { TableColumnsType, UploadFile } from 'antd';
import { Download, FileUp, UploadCloud } from 'lucide-react';
import {
  patentImportApi,
  type PatentImportIssue,
  type PatentImportResult,
} from '../../services/patentRecordApi';

const { Text, Paragraph } = Typography;

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';

const describeError = (error: unknown): string => {
  const raw = getErrorMessage(error);
  const tooMany = /^PATENT_CSV_TOO_MANY_ROWS:(\d+)$/.exec(raw);
  if (tooMany) return `한 번에 최대 ${tooMany[1]}행까지 올릴 수 있습니다.`;
  const map: Record<string, string> = {
    PATENT_CSV_EMPTY: '내용이 없는 파일입니다.',
    PATENT_CSV_FILE_REQUIRED: 'CSV 파일을 선택해 주세요.',
    PATENT_CSV_APPLICATION_NUMBER_COLUMN_MISSING:
      '"출원번호" 컬럼이 없습니다. 템플릿의 컬럼명을 확인해 주세요.',
    PATENT_CSV_COUNTRY_COLUMN_MISSING:
      '"출원국" 컬럼이 없습니다. 템플릿의 컬럼명을 확인해 주세요.',
  };
  return map[raw] ?? raw;
};

type Props = {
  open: boolean;
  onCancel: () => void;
  /** APPLY가 끝나면 호출. 부모가 목록을 다시 읽는다. */
  onApplied: () => void;
};

const issueColumns: TableColumnsType<PatentImportIssue> = [
  {
    title: '행',
    dataIndex: 'rowNumber',
    key: 'rowNumber',
    width: 64,
    render: (value: number | null) => value ?? '-',
  },
  {
    title: '구분',
    dataIndex: 'severity',
    key: 'severity',
    width: 76,
    render: (severity: PatentImportIssue['severity']) => (
      <Tag color={severity === 'ERROR' ? 'red' : 'orange'}>
        {severity === 'ERROR' ? '오류' : '주의'}
      </Tag>
    ),
  },
  {
    title: '출원번호',
    dataIndex: 'applicationNumber',
    key: 'applicationNumber',
    width: 150,
    render: (value: string | null) => value ?? '-',
  },
  { title: '내용', dataIndex: 'message', key: 'message' },
];

const PatentCsvImportModal: React.FC<Props> = ({ open, onCancel, onApplied }) => {
  const { message } = AntApp.useApp();
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [duplicateMode, setDuplicateMode] = useState<'SKIP' | 'UPDATE'>('SKIP');
  const [result, setResult] = useState<PatentImportResult | null>(null);
  const [running, setRunning] = useState(false);

  const selectedFile = fileList[0]?.originFileObj as File | undefined;
  /** DRY_RUN을 통과했고 오류가 없어야 반영할 수 있다. */
  const canApply =
    result !== null && result.mode === 'DRY_RUN' && result.errorCount === 0;

  const reset = () => {
    setFileList([]);
    setResult(null);
    setDuplicateMode('SKIP');
  };

  const run = async (mode: 'DRY_RUN' | 'APPLY') => {
    if (!selectedFile) {
      void message.warning('CSV 파일을 선택해 주세요.');
      return;
    }
    setRunning(true);
    try {
      const next = await patentImportApi.run(selectedFile, mode, duplicateMode);
      setResult(next);
      if (mode === 'APPLY') {
        void message.success(
          `반영했습니다. 추가 ${next.insertCount}건, 변경 ${next.updateCount}건.`,
        );
        onApplied();
        reset();
        onCancel();
      } else if (next.errorCount > 0) {
        void message.warning(`오류 ${next.errorCount}건을 먼저 해결해 주세요.`);
      } else {
        void message.success('검사를 통과했습니다. 반영할 수 있습니다.');
      }
    } catch (error) {
      void message.error(describeError(error));
    } finally {
      setRunning(false);
    }
  };

  return (
    <Modal
      open={open}
      title="CSV로 업로드"
      width={860}
      maskClosable={false}
      onCancel={() => {
        reset();
        onCancel();
      }}
      footer={[
        <Button
          key="template"
          icon={<Download size={14} />}
          href={patentImportApi.templateUrl()}
        >
          템플릿 받기
        </Button>,
        <Button
          key="dry-run"
          icon={<FileUp size={14} />}
          loading={running}
          disabled={!selectedFile}
          onClick={() => void run('DRY_RUN')}
        >
          검사하기
        </Button>,
        <Button
          key="apply"
          type="primary"
          icon={<UploadCloud size={14} />}
          loading={running}
          disabled={!canApply}
          onClick={() => void run('APPLY')}
        >
          반영하기
        </Button>,
      ]}
    >
      <Paragraph type="secondary" style={{ marginBottom: 12 }}>
        Google Sheets에서 CSV로 내보낸 뒤 올려주세요. <b>검사하기</b>로 결과를 먼저 확인하고,
        오류가 없을 때만 <b>반영하기</b>가 켜집니다. 컬럼명은 템플릿과 같아야 하며
        <b> 출원국</b>과 <b>출원번호</b>는 필수입니다.
      </Paragraph>

      <Upload
        accept=".csv,text/csv"
        maxCount={1}
        fileList={fileList}
        beforeUpload={() => false}
        onChange={({ fileList: next }) => {
          setFileList(next);
          setResult(null);
        }}
      >
        <Button icon={<FileUp size={14} />}>CSV 파일 선택</Button>
      </Upload>

      <div style={{ marginTop: 16 }}>
        <Text style={{ marginRight: 12 }}>이미 있는 출원번호</Text>
        <Radio.Group
          value={duplicateMode}
          disabled={running}
          onChange={(event) => {
            setDuplicateMode(event.target.value as 'SKIP' | 'UPDATE');
            setResult(null);
          }}
        >
          <Radio.Button value="SKIP">건너뛰기</Radio.Button>
          <Radio.Button value="UPDATE">덮어쓰기</Radio.Button>
        </Radio.Group>
      </div>

      {result && (
        <div style={{ marginTop: 20 }}>
          <Descriptions bordered size="small" column={5}>
            <Descriptions.Item label="전체">{result.sourceCount}</Descriptions.Item>
            <Descriptions.Item label="추가">{result.insertCount}</Descriptions.Item>
            <Descriptions.Item label="변경">{result.updateCount}</Descriptions.Item>
            <Descriptions.Item label="건너뜀">{result.skipCount}</Descriptions.Item>
            <Descriptions.Item label="오류">
              {result.errorCount > 0 ? (
                <Text type="danger">{result.errorCount}</Text>
              ) : (
                result.errorCount
              )}
            </Descriptions.Item>
          </Descriptions>

          {result.ignoredHeaders.length > 0 && (
            <Alert
              type="warning"
              showIcon
              style={{ marginTop: 12 }}
              message="알 수 없는 컬럼은 무시됩니다"
              description={result.ignoredHeaders.join(', ')}
            />
          )}

          {(result.newCodes.countries.length > 0 ||
            result.newCodes.legalStatuses.length > 0 ||
            result.newCodes.examStatuses.length > 0 ||
            result.newCodes.targets.length > 0 ||
            result.newCodes.applicants.length > 0 ||
            result.newCodes.inventors.length > 0) && (
            <Alert
              type="info"
              showIcon
              style={{ marginTop: 12 }}
              message="반영 시 새로 만들어질 코드"
              description={
                <>
                  {result.newCodes.countries.length > 0 && (
                    <div>국가: {result.newCodes.countries.join(', ')}</div>
                  )}
                  {result.newCodes.legalStatuses.length > 0 && (
                    <div>법적 상태: {result.newCodes.legalStatuses.join(', ')}</div>
                  )}
                  {result.newCodes.examStatuses.length > 0 && (
                    <div>심사 상태: {result.newCodes.examStatuses.join(', ')}</div>
                  )}
                  {result.newCodes.targets.length > 0 && (
                    <div>Target: {result.newCodes.targets.join(', ')}</div>
                  )}
                  {result.newCodes.applicants.length > 0 && (
                    <div>출원인: {result.newCodes.applicants.join(', ')}</div>
                  )}
                  {result.newCodes.inventors.length > 0 && (
                    <div>발명자: {result.newCodes.inventors.join(', ')}</div>
                  )}
                </>
              }
            />
          )}

          {result.issues.length > 0 && (
            <Table<PatentImportIssue>
              style={{ marginTop: 12 }}
              columns={issueColumns}
              dataSource={result.issues}
              rowKey={(issue, index) => `${issue.rowNumber}-${issue.errorCode}-${index}`}
              size="small"
              pagination={{ pageSize: 8, size: 'small' }}
              scroll={{ y: 240 }}
            />
          )}
        </div>
      )}
    </Modal>
  );
};

export default PatentCsvImportModal;
