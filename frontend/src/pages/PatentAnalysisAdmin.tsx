import React from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Form,
  Input,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  Upload,
} from 'antd';
import type { TableColumnsType, UploadFile } from 'antd';
import {
  Check,
  ChevronDown,
  ChevronUp,
  FileUp,
  RefreshCw,
  RotateCcw,
  Search,
  Target,
  X,
} from 'lucide-react';
import PageHeaderBreadcrumb from '../components/common/PageHeaderBreadcrumb';
import { getPatentAnalysisLayoutPreset } from '../config/patentAnalysisLayout';
import { useAuthSession } from '../contexts/AuthSessionContext';
import { useViewportTableHeight } from '../hooks/useViewportTableHeight';
import {
  patentAnalysisAdminApi,
  type ActivePatentTarget,
  type AdminPatentRow,
  type PatentTargetRequest,
} from '../services/patentAnalysisAdminApi';
import { useUIStore } from '../store/useUIStore';
import { formatDisplayDate, formatNumberWithComma } from '../utils/displayFormat';

const { Text } = Typography;
const PAGE_SIZE_OPTIONS = ['10', '30', '50', '100'];
const statusMeta: Record<string, { label: string; color: string }> = {
  REQUESTED: { label: '수정 요청', color: 'warning' },
  ANALYZING: { label: '분석 중', color: 'processing' },
  BIOACTIVITY_FAILED: { label: 'Bioactivity 오류', color: 'error' },
  NO_COMPOUND: { label: '화합물 없음', color: 'default' },
  COMPLETED: { label: '분석 완료', color: 'success' },
  MODIFIED_COMPLETED: { label: 'Bioactivity 수정 완료', color: 'success' },
  ERROR: { label: '분석 오류', color: 'error' },
  UNKNOWN: { label: '확인 필요', color: 'default' },
};
const patentStatusOptions = [
  { label: '수정 요청', value: 'request' },
  { label: '분석 중', value: 'analysis' },
  { label: 'Bioactivity 오류', value: 'bioactivity fail' },
  { label: '화합물 없음', value: 'no compound' },
  { label: '분석 완료', value: 'complete' },
  { label: 'Bioactivity 수정 완료', value: 'modified complete' },
  { label: '분석 오류', value: 'error' },
];
const patentDateSortFieldOptions = [
  { label: '분석일', value: 'date_created' },
  { label: '수정일', value: 'date_updated' },
  { label: '출판일', value: 'publication_date' },
];
const patentDateSortOrderOptions = [
  { label: '최신순', value: 'desc' },
  { label: '오래된순', value: 'asc' },
];

type PatentDateSortField = 'date_created' | 'date_updated' | 'publication_date';
type PatentDateSortOrder = 'asc' | 'desc';

type PatentForm = {
  publicationDate?: string;
  targets?: string[];
  applicant?: string;
  status?: string;
  comment?: string;
};
type TargetForm = { targetName: string; keywords: string[] };

const PatentAnalysisAdmin: React.FC = () => {
  const session = useAuthSession();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { setHeaderContent } = useUIStore();
  const [patentForm] = Form.useForm<PatentForm>();
  const [targetForm] = Form.useForm<TargetForm>();
  const [activeTargetForm] = Form.useForm<TargetForm>();
  const [viewportWidth, setViewportWidth] = React.useState(() => (
    typeof window === 'undefined' ? 1920 : window.innerWidth
  ));
  const activeTab = searchParams.get('tab') === 'targets' ? 'targets' : 'analysis';
  const analysisTable = useViewportTableHeight({ enabled: activeTab === 'analysis', minHeight: 240 });
  const layoutPreset = React.useMemo(
    () => getPatentAnalysisLayoutPreset(viewportWidth),
    [viewportWidth],
  );

  const [patents, setPatents] = React.useState<AdminPatentRow[]>([]);
  const [patentTotal, setPatentTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(30);
  const [keyword, setKeyword] = React.useState('');
  const [appliedKeyword, setAppliedKeyword] = React.useState('');
  const [status, setStatus] = React.useState<string>();
  const [requestOnly, setRequestOnly] = React.useState(false);
  const [showFilters, setShowFilters] = React.useState(false);
  const [sortField, setSortField] = React.useState<PatentDateSortField>('date_updated');
  const [sortOrder, setSortOrder] = React.useState<PatentDateSortOrder>('desc');
  const [loadingPatents, setLoadingPatents] = React.useState(false);
  const [patentError, setPatentError] = React.useState<string>();
  const [editingPatent, setEditingPatent] = React.useState<AdminPatentRow>();
  const [uploadPatent, setUploadPatent] = React.useState<AdminPatentRow>();
  const [uploadFiles, setUploadFiles] = React.useState<UploadFile[]>([]);
  const [saving, setSaving] = React.useState(false);

  const [pendingTargets, setPendingTargets] = React.useState<PatentTargetRequest[]>([]);
  const [activeTargets, setActiveTargets] = React.useState<ActivePatentTarget[]>([]);
  const [loadingTargets, setLoadingTargets] = React.useState(false);
  const [targetError, setTargetError] = React.useState<string>();
  const [editingTarget, setEditingTarget] = React.useState<PatentTargetRequest>();
  const [editingActiveTarget, setEditingActiveTarget] = React.useState<ActivePatentTarget>();

  React.useEffect(() => {
    setHeaderContent(<PageHeaderBreadcrumb items={[
      { label: '특허 분석 관리' },
    ]} />);
    return () => setHeaderContent(null);
  }, [setHeaderContent]);

  React.useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const loadPatents = React.useCallback(async () => {
    setLoadingPatents(true);
    setPatentError(undefined);
    try {
      const result = await patentAnalysisAdminApi.listPatents({
        page,
        pageSize,
        keyword: appliedKeyword,
        status,
        requestOnly,
        sortField,
        sortOrder,
      });
      setPatents(result.items);
      setPatentTotal(result.totalCount);
    } catch (error) {
      setPatentError(error instanceof Error ? error.message : '특허 목록을 불러오지 못했습니다.');
    } finally {
      setLoadingPatents(false);
    }
  }, [appliedKeyword, page, pageSize, requestOnly, sortField, sortOrder, status]);

  const loadTargets = React.useCallback(async () => {
    setLoadingTargets(true);
    setTargetError(undefined);
    try {
      const [pending, active] = await Promise.all([
        patentAnalysisAdminApi.listPendingTargets(),
        patentAnalysisAdminApi.listActiveTargets(),
      ]);
      setPendingTargets(pending);
      setActiveTargets(active);
    } catch (error) {
      setTargetError(error instanceof Error ? error.message : '타겟 목록을 불러오지 못했습니다.');
    } finally {
      setLoadingTargets(false);
    }
  }, []);

  const resetPatentFilters = () => {
    setKeyword('');
    setAppliedKeyword('');
    setStatus(undefined);
    setRequestOnly(false);
    setSortField('date_updated');
    setSortOrder('desc');
    setPage(1);
  };

  React.useEffect(() => {
    if (session.user.role !== 'ADMIN') return;
    if (activeTab === 'analysis') void loadPatents();
    else void loadTargets();
  }, [activeTab, loadPatents, loadTargets, session.user.role]);

  const openPatentEdit = (record: AdminPatentRow) => {
    setEditingPatent(record);
    patentForm.setFieldsValue({
      publicationDate: record.publication_date ?? undefined,
      targets: record.target,
      applicant: record.applicant ?? undefined,
      status: record.status,
      comment: record.comment ?? undefined,
    });
  };

  const savePatent = async () => {
    if (!editingPatent) return;
    const values = await patentForm.validateFields();
    setSaving(true);
    try {
      await patentAnalysisAdminApi.modifyPatent(editingPatent.publication_number, values);
      void message.success('특허 정보를 수정했습니다.');
      setEditingPatent(undefined);
      await loadPatents();
    } catch (error) {
      void message.error(error instanceof Error ? error.message : '수정에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const uploadBioactivity = async () => {
    const file = uploadFiles[0]?.originFileObj;
    if (!uploadPatent || !file) {
      void message.warning('CSV 또는 XLSX 파일을 선택해 주세요.');
      return;
    }
    setSaving(true);
    try {
      await patentAnalysisAdminApi.uploadBioactivity(uploadPatent.publication_number, file);
      void message.success('Bioactivity 파일을 업로드했습니다.');
      setUploadPatent(undefined);
      setUploadFiles([]);
      await loadPatents();
    } catch (error) {
      void message.error(error instanceof Error ? error.message : '업로드에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const openTargetReview = (record: PatentTargetRequest) => {
    setEditingTarget(record);
    targetForm.setFieldsValue({
      targetName: record.requestedTargetName,
      keywords: record.keywords,
    });
  };

  const approveTarget = async () => {
    if (!editingTarget) return;
    const values = await targetForm.validateFields();
    setSaving(true);
    try {
      await patentAnalysisAdminApi.approveTarget(editingTarget.id, values);
      void message.success('신규 타겟을 승인했습니다.');
      setEditingTarget(undefined);
      await loadTargets();
    } catch (error) {
      void message.error(error instanceof Error ? error.message : '승인에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const saveActiveTarget = async () => {
    if (!editingActiveTarget?.target_name) return;
    const values = await activeTargetForm.validateFields();
    setSaving(true);
    try {
      await patentAnalysisAdminApi.modifyActiveTarget(editingActiveTarget.target_name, values);
      void message.success('타겟 정보를 수정했습니다.');
      setEditingActiveTarget(undefined);
      await loadTargets();
    } catch (error) {
      void message.error(error instanceof Error ? error.message : '수정에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const rejectTarget = async (row: PatentTargetRequest) => {
    try {
      await patentAnalysisAdminApi.rejectTarget(row.id);
      void message.success('요청을 반려했습니다.');
      await loadTargets();
    } catch (error) {
      void message.error(error instanceof Error ? error.message : '반려에 실패했습니다.');
    }
  };

  const deleteActiveTarget = async (row: ActivePatentTarget) => {
    if (!row.target_name) return;
    try {
      await patentAnalysisAdminApi.deleteActiveTarget(row.target_name);
      void message.success('타겟을 삭제했습니다.');
      await loadTargets();
    } catch (error) {
      void message.error(error instanceof Error ? error.message : '삭제에 실패했습니다.');
    }
  };

  const patentColumns: TableColumnsType<AdminPatentRow> = [
    {
      title: 'No.', width: 72, align: 'center',
      render: (_, __, index) => formatNumberWithComma((page - 1) * pageSize + index + 1),
    },
    { title: '분석일', dataIndex: 'date_created', width: 145, align: 'center', render: formatDisplayDate },
    { title: '수정일', dataIndex: 'date_updated', width: 145, align: 'center', render: formatDisplayDate },
    {
      title: '특허 번호', dataIndex: 'publication_number', width: 170, align: 'center',
      render: (value: string) => <Button type="link" onClick={() => navigate(`/patents/analysis/${encodeURIComponent(value)}`)}>{value}</Button>,
    },
    { title: '출판일', dataIndex: 'publication_date', width: 120, align: 'center', render: formatDisplayDate },
    {
      title: '상태', dataIndex: 'canonicalStatus', width: 150, align: 'center',
      render: (value: string, record) => {
        const meta = statusMeta[value] ?? statusMeta.UNKNOWN;
        return <Tooltip title={value === 'UNKNOWN' ? record.status : undefined}><Tag color={meta.color}>{meta.label}</Tag></Tooltip>;
      },
    },
    { title: '출원인', dataIndex: 'applicant', width: 210, ellipsis: true },
    {
      title: '타겟', dataIndex: 'target', width: 170,
      render: (value: string[]) => (
        <Space size={[4, 4]} wrap>
          {(value ?? []).map((item) => <Tag key={item}>{item}</Tag>)}
        </Space>
      ),
    },
    {
      title: '요청자', dataIndex: 'requester', width: 180, align: 'center',
      render: (_, record) => record.requester
        ? <Tooltip title={record.requester.email}>{record.requester.name} ({record.requester.memberId})</Tooltip>
        : record.requesterUnknown ? <Text type="secondary">확인 불가</Text> : '-',
    },
    { title: 'Quality', dataIndex: 'quality', width: 90, align: 'center' },
    { title: '요청일', dataIndex: 'request_date', width: 145, align: 'center', render: formatDisplayDate },
    { title: '완료일', dataIndex: 'complete_date', width: 145, align: 'center', render: formatDisplayDate },
    { title: '비고', dataIndex: 'comment', width: 220, ellipsis: true },
    {
      title: '관리', key: 'actions', width: 190, fixed: 'right', align: 'center',
      render: (_, record) => <Space>
        <Button size="small" onClick={() => openPatentEdit(record)}>수정</Button>
        <Button size="small" type="primary" icon={<FileUp size={14} />} onClick={() => setUploadPatent(record)}>Bioactivity</Button>
      </Space>,
    },
  ];

  const pendingColumns: TableColumnsType<PatentTargetRequest> = [
    { title: '요청일', dataIndex: 'createdAt', width: 145, align: 'center', render: formatDisplayDate },
    { title: '요청자', width: 190, align: 'center', render: (_, row) => `${row.requester.name} (${row.requesterMemberId})` },
    { title: '요청 타겟명', dataIndex: 'requestedTargetName', width: 190, align: 'center' },
    { title: '키워드', dataIndex: 'keywords', render: (values: string[]) => <Space wrap>{values.map((value) => <Tag key={value}>{value}</Tag>)}</Space> },
    {
      title: '관리', width: 160, align: 'center',
      render: (_, row) => <Space>
        <Button size="small" type="primary" onClick={() => openTargetReview(row)}>검토</Button>
        <Popconfirm title="이 신규 타겟 요청을 반려할까요?" onConfirm={() => rejectTarget(row)}>
          <Button size="small" danger icon={<X size={13} />}>반려</Button>
        </Popconfirm>
      </Space>,
    },
  ];

  const activeColumns: TableColumnsType<ActivePatentTarget> = [
    { title: '수정일', dataIndex: 'date_updated', width: 150, align: 'center', render: formatDisplayDate },
    { title: '등록 타겟명', dataIndex: 'target_name', width: 220, align: 'center' },
    { title: '키워드', dataIndex: 'keyword', render: (values?: string[]) => <Space wrap>{(values ?? []).map((value) => <Tag key={value}>{value}</Tag>)}</Space> },
    {
      title: '등록자',
      dataIndex: 'email',
      width: 220,
      align: 'center',
      render: (value?: string | null) => value || <Text type="secondary">확인 불가</Text>,
    },
    {
      title: '관리', width: 170, align: 'center',
      render: (_, row) => <Space>
        <Button size="small" onClick={() => {
          setEditingActiveTarget(row);
          activeTargetForm.setFieldsValue({
            targetName: row.target_name ?? '',
            keywords: row.keyword ?? [],
          });
        }}>수정</Button>
        <Popconfirm title="이 등록 타겟을 삭제할까요?" onConfirm={() => deleteActiveTarget(row)}>
          <Button size="small" danger>삭제</Button>
        </Popconfirm>
      </Space>,
    },
  ];

  if (session.user.role !== 'ADMIN') return <Navigate to="/dashboard" replace />;

  const analysisContent = (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
      <Card variant="borderless" className="c-card compact-filter-card" style={{ marginBottom: 12 }}>
        <Space wrap>
          <Input
            allowClear
            prefix={<Search size={16} />}
            placeholder="특허 번호 검색"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            onPressEnter={() => { setAppliedKeyword(keyword.trim()); setPage(1); }}
            className="v-search-input"
            style={{ width: 280 }}
          />
          <Button type={requestOnly ? 'primary' : 'default'} onClick={() => { setRequestOnly((value) => !value); setPage(1); }}>
            수정 요청만
          </Button>
          <Button
            icon={showFilters ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            onClick={() => setShowFilters((value) => !value)}
            className="v-action-btn"
          >
            상세 필터 {showFilters ? '닫기' : '열기'}
          </Button>
          <Button
            type="primary"
            icon={<Search size={15} />}
            className="v-action-btn"
            onClick={() => { setAppliedKeyword(keyword.trim()); setPage(1); }}
          >
            검색
          </Button>
        </Space>
        {showFilters && (
          <div className="compact-filter-panel">
            <Row gutter={[24, 12]} align="bottom">
              <Col xs={24} sm={12} md={6}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                  <Text strong>분석 상태</Text>
                  <Select
                    allowClear
                    placeholder="전체"
                    value={status}
                    onChange={(value) => { setStatus(value); setPage(1); }}
                    options={patentStatusOptions}
                    style={{ width: 190, maxWidth: '100%' }}
                  />
                </div>
              </Col>
              <Col xs={24} sm={12} md={12}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                  <Text strong>날짜 기준 정렬</Text>
                  <Space.Compact>
                    <Select<PatentDateSortField>
                      value={sortField}
                      onChange={(value) => {
                        setSortField(value);
                        setPage(1);
                      }}
                      options={patentDateSortFieldOptions}
                      style={{ width: 128 }}
                      aria-label="날짜 정렬 기준"
                    />
                    <Select<PatentDateSortOrder>
                      value={sortOrder}
                      onChange={(value) => {
                        setSortOrder(value);
                        setPage(1);
                      }}
                      options={patentDateSortOrderOptions}
                      style={{ width: 120 }}
                      aria-label="날짜 정렬 방향"
                    />
                  </Space.Compact>
                </div>
              </Col>
              <Col
                xs={24}
                sm={12}
                md={6}
                style={{ display: 'flex', justifyContent: 'flex-end' }}
              >
                <Button
                  icon={<RotateCcw size={15} />}
                  className="v-action-btn"
                  onClick={resetPatentFilters}
                >
                  초기화
                </Button>
              </Col>
            </Row>
          </div>
        )}
      </Card>
      {patentError && <Alert type="error" showIcon message={patentError} style={{ marginBottom: 12 }} />}
      <div className="v-table-card" style={{ flex: 1, minHeight: 0 }}>
        <div className="v-table-header"><Text strong>분석 현황</Text><Text type="secondary">{formatNumberWithComma(patentTotal)} patents</Text></div>
        <div ref={analysisTable.tableRegionRef} style={analysisTable.tableRegionStyle}>
          <Table
            className="my-board-table viewport-fill-table"
            rowKey="publication_number"
            size="small"
            loading={loadingPatents}
            columns={patentColumns}
            dataSource={patents}
            scroll={{ x: 2200, y: analysisTable.tableBodyHeight }}
            pagination={{
              current: page,
              pageSize,
              total: patentTotal,
              showSizeChanger: true,
              pageSizeOptions: PAGE_SIZE_OPTIONS,
              itemRender: (number, type, element) => type === 'page' ? <span>{formatNumberWithComma(number)}</span> : element,
              onChange: (nextPage, nextSize) => {
                setPage(nextSize === pageSize ? nextPage : 1);
                setPageSize(nextSize);
              },
            }}
          />
        </div>
      </div>
    </div>
  );

  const targetsContent = (
    <div
      className="patent-analysis-admin-scroll-region"
      style={{ overflow: 'auto', maxHeight: 'calc(100vh - 210px)', paddingRight: 4 }}
    >
      <Space style={{ marginBottom: 12 }}>
        <Button icon={<RefreshCw size={15} />} onClick={() => void loadTargets()}>새로고침</Button>
      </Space>
      {targetError && <Alert type="error" showIcon message={targetError} style={{ marginBottom: 12 }} />}
      <div className="v-table-card" style={{ marginBottom: 16 }}>
        <div className="v-table-header"><Text strong>신규 타겟 요청</Text><Text type="secondary">{formatNumberWithComma(pendingTargets.length)} requests</Text></div>
        <Table rowKey="id" size="small" loading={loadingTargets} columns={pendingColumns} dataSource={pendingTargets} pagination={{ pageSize: 10, showSizeChanger: false }} />
      </div>
      <div className="v-table-card">
        <div className="v-table-header"><Text strong>등록된 전체 타겟</Text><Text type="secondary">{formatNumberWithComma(activeTargets.length)} targets</Text></div>
        <Table rowKey={(row) => row.target_name ?? String(row.date_updated)} size="small" loading={loadingTargets} columns={activeColumns} dataSource={activeTargets} pagination={{ pageSize: 30, showSizeChanger: true, pageSizeOptions: PAGE_SIZE_OPTIONS }} />
      </div>
    </div>
  );

  return (
    <div
      className="patent-analysis-admin-page"
      style={{
        maxWidth: layoutPreset.maxWidth,
        margin: '0 auto',
        padding: `0 ${layoutPreset.sidePadding}px`,
        height: '100%',
        width: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Tabs
        activeKey={activeTab}
        onChange={(tab) => setSearchParams({ tab })}
        style={{ flex: 1, minHeight: 0 }}
        items={[
          {
            key: 'analysis',
            label: (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 20, lineHeight: '20px' }}>
                <FileUp size={15} style={{ display: 'block', flexShrink: 0 }} />
                <span>분석 현황 / Bioactivity 수정 요청</span>
              </span>
            ),
            children: analysisContent,
          },
          {
            key: 'targets',
            label: (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 20, lineHeight: '20px' }}>
                <Target size={15} style={{ display: 'block', flexShrink: 0 }} />
                <span>신규 특허 타겟 관리</span>
              </span>
            ),
            children: targetsContent,
          },
        ]}
      />

      <Modal title={`특허 정보 수정 · ${editingPatent?.publication_number ?? ''}`} open={Boolean(editingPatent)} confirmLoading={saving} onOk={() => void savePatent()} onCancel={() => setEditingPatent(undefined)}>
        <Form form={patentForm} layout="vertical">
          <Form.Item label="출판일" name="publicationDate"><Input placeholder="YYYY-MM-DD" /></Form.Item>
          <Form.Item label="타겟" name="targets"><Select mode="tags" /></Form.Item>
          <Form.Item label="출원인" name="applicant"><Input /></Form.Item>
          <Form.Item label="상태" name="status"><Select options={patentStatusOptions} /></Form.Item>
          <Form.Item label="비고" name="comment"><Input.TextArea rows={4} /></Form.Item>
        </Form>
      </Modal>

      <Modal title={`Bioactivity 업로드 · ${uploadPatent?.publication_number ?? ''}`} open={Boolean(uploadPatent)} confirmLoading={saving} okText="업로드" onOk={() => void uploadBioactivity()} onCancel={() => { setUploadPatent(undefined); setUploadFiles([]); }}>
        <Alert type="info" showIcon message="CSV/XLSX에는 SMILES 또는 canonical_smiles 중 하나와 compound_id 또는 example_number 중 하나가 필요합니다." style={{ marginBottom: 16 }} />
        <Upload.Dragger accept=".csv,.xlsx" maxCount={1} beforeUpload={() => false} fileList={uploadFiles} onChange={({ fileList }) => setUploadFiles(fileList.slice(-1))}>
          <p className="ant-upload-drag-icon"><FileUp size={30} /></p>
          <p className="ant-upload-text">파일을 끌어놓거나 선택하세요.</p>
        </Upload.Dragger>
      </Modal>

      <Modal title="신규 타겟 검토" open={Boolean(editingTarget)} confirmLoading={saving} okText="승인" okButtonProps={{ icon: <Check size={14} /> }} onOk={() => void approveTarget()} onCancel={() => setEditingTarget(undefined)}>
        <Form form={targetForm} layout="vertical">
          <Form.Item label="등록 타겟명" name="targetName" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item label="키워드" name="keywords"><Select mode="tags" /></Form.Item>
        </Form>
      </Modal>

      <Modal title="등록 타겟 수정" open={Boolean(editingActiveTarget)} confirmLoading={saving} okText="수정" onOk={() => void saveActiveTarget()} onCancel={() => setEditingActiveTarget(undefined)}>
        <Form form={activeTargetForm} layout="vertical">
          <Form.Item label="등록 타겟명" name="targetName" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item label="키워드" name="keywords"><Select mode="tags" /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default PatentAnalysisAdmin;
