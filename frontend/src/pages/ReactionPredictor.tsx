import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  Input,
  Modal,
  Progress,
  Row,
  Segmented,
  Space,
  Table,
  Tag,
  Typography,
  theme,
} from 'antd';
import type { TableProps } from 'antd';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import PageHeaderBreadcrumb from '../components/common/PageHeaderBreadcrumb';
import ChemDrawEditor from '../components/common/ChemDrawEditor';
import ChemDrawModal from '../components/common/ChemDrawModal';
import CompoundStructureView from '../components/common/CompoundStructureView';
import BenzeneIcon from '../components/common/BenzeneIcon';
import oaProfile022 from '../assets/reaction_predictor/oa_profile_022.png';
import oaProfile028 from '../assets/reaction_predictor/oa_profile_028.png';
import oaProfileTriBromo from '../assets/reaction_predictor/oa_profile_tri_bromo.png';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { useUIStore } from '../store/useUIStore';
import {
  mockReactionPredictions,
  type ConfidenceCheck,
  type ReactionPredictionRow,
  type ReactionSite,
  type ReactionType,
} from '../mocks/reactionPredictions';
import { formatDisplayDate } from '../utils/displayFormat';

const { Text, Title } = Typography;

const reactionTypeOptions = [
  { label: 'Oxidative Addition (OA)', value: 'oa' },
  { label: 'SNAr', value: 'snar' },
];

const statusMeta: Record<ReactionPredictionRow['status'], { color: string; label: string }> = {
  completed: { color: 'success', label: 'Completed' },
  calculating: { color: 'processing', label: 'Calculating' },
  failed: { color: 'error', label: 'Failed' },
};

const checkStatusMeta: Record<ConfidenceCheck['status'], { className: string; label: string }> = {
  pass: { className: 'reaction-check-pass', label: 'PASS' },
  review: { className: 'reaction-check-review', label: 'REVIEW' },
  fail: { className: 'reaction-check-fail', label: 'FAIL' },
};

const reactionProfileImages: Record<string, string> = {
  'rp-001': oaProfileTriBromo,
  'rp-002': oaProfile028,
  'rp-003': oaProfile022,
};

const getReactionProfileImage = (row: ReactionPredictionRow) =>
  reactionProfileImages[row.id] ?? oaProfileTriBromo;

const formatNumberWithComma = (value: number) =>
  String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

const ReactionPredictor: React.FC = () => {
  const { token } = theme.useToken();
  const { setHeaderContent } = useUIStore();
  const { layoutPreset, isSmall } = useResponsiveLayout();
  const [rows, setRows] = useState<ReactionPredictionRow[]>(mockReactionPredictions);
  const [reactionType, setReactionType] = useState<ReactionType>('oa');
  const [keyword, setKeyword] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedRowId, setSelectedRowId] = useState(mockReactionPredictions[0]?.id);
  const [isPredictionModalOpen, setIsPredictionModalOpen] = useState(false);
  const [isStructureModalOpen, setIsStructureModalOpen] = useState(false);
  const [predictionName, setPredictionName] = useState('OA-032');
  const [predictionSmiles, setPredictionSmiles] = useState('');
  const predictionEditorRef = React.useRef<any>(null);
  const [detectedSites, setDetectedSites] = useState<ReactionSite[]>([
    { site: 'C3', leavingGroup: 'Br', enabled: false },
    { site: 'C4', leavingGroup: 'Br', enabled: false },
    { site: 'C5', leavingGroup: 'Br', enabled: false },
  ]);

  useEffect(() => {
    setHeaderContent(
      <PageHeaderBreadcrumb items={[{ label: 'Reaction Predictor' }]} />
    );

    return () => setHeaderContent(null);
  }, [setHeaderContent]);

  const filteredRows = useMemo(() => {
    const searchTerm = keyword.trim().toLowerCase();

    return rows.filter((row) => {
      if (row.reactionType !== reactionType) return false;
      if (!searchTerm) return true;

      return (
        row.name.toLowerCase().includes(searchTerm) ||
        row.smiles.toLowerCase().includes(searchTerm) ||
        row.majorSite.toLowerCase().includes(searchTerm)
      );
    });
  }, [keyword, reactionType, rows]);

  const selectedRow = useMemo(() => {
    return filteredRows.find((row) => row.id === selectedRowId) ?? filteredRows[0];
  }, [filteredRows, selectedRowId]);

  const handleSiteToggle = (site: string, checked: boolean) => {
    setDetectedSites((prev) =>
      prev.map((item) => (item.site === site ? { ...item, enabled: checked } : item))
    );
  };

  const handleSiteRowToggle = (site: string) => {
    setDetectedSites((prev) =>
      prev.map((item) => (item.site === site ? { ...item, enabled: !item.enabled } : item))
    );
  };

  const handleStructureSearchConfirm = (data: { smiles: string; svg: string | null }) => {
    const { smiles, svg } = data;
    console.log('Extracted Data:', { smiles, svgLength: svg?.length });

    if (smiles && smiles.trim() !== '') {
      setKeyword(smiles);
    } else {
      setKeyword('Structure Search Result');
    }

    setIsStructureModalOpen(false);
  };

  const handleRunPrediction = async () => {
    const flushedSmiles = await predictionEditorRef.current?.__flushPendingInput?.();
    const nextSmiles = typeof flushedSmiles === 'string' ? flushedSmiles : predictionSmiles;
    const sourceRow = mockReactionPredictions[0];
    const enabledSites = detectedSites.filter((site) => site.enabled);
    const nextRow: ReactionPredictionRow = {
      ...sourceRow,
      id: `rp-${Date.now()}`,
      name: predictionName.trim() || 'OA prediction',
      smiles: nextSmiles.trim() || sourceRow.smiles,
      reactionType,
      sites: enabledSites.length > 0 ? enabledSites : detectedSites,
      startDate: '26.06.01 10:30',
      endDate: '26.06.01 10:44',
      status: 'completed',
    };

    setRows((prev) => [nextRow, ...prev]);
    setSelectedRowId(nextRow.id);
    setIsPredictionModalOpen(false);
  };

  const columns: TableProps<ReactionPredictionRow>['columns'] = [
    {
      title: 'Name',
      dataIndex: 'name',
      align: 'center',
      width: 130,
      render: (value: string) => <Text strong>{value}</Text>,
    },
    {
      title: 'Molecule',
      dataIndex: 'moleculeSvg',
      align: 'center',
      width: 212,
      render: (svg: string, row) => (
        <CompoundStructureView
          svg={svg}
          title={row.name || 'Structure'}
          smiles={row.smiles}
          width={168}
          height={108}
          iconSize={40}
          gap={6}
          showPreviewAction={false}
          showCopyAction={false}
          frameStyle={{ border: 0, background: 'transparent', boxShadow: 'none' }}
        />
      ),
    },
    {
      title: 'Major site',
      dataIndex: 'majorSite',
      align: 'center',
      width: 120,
      render: (value: string) => <Tag color="cyan">{value}</Tag>,
    },
    {
      title: 'ΔΔG‡ (kJ/mol)',
      dataIndex: 'deltaDeltaG',
      align: 'right',
      width: 130,
      render: (value: number | null) => (value === null ? '-' : value.toFixed(1)),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      align: 'center',
      width: 120,
      render: (value: ReactionPredictionRow['status']) => (
        <Tag color={statusMeta[value].color}>{statusMeta[value].label}</Tag>
      ),
    },
    {
      title: 'Start Date',
      dataIndex: 'startDate',
      align: 'center',
      width: 130,
      render: formatDisplayDate,
    },
    {
      title: 'End Date',
      dataIndex: 'endDate',
      align: 'center',
      width: 130,
      render: formatDisplayDate,
    },
  ];

  return (
    <div
      className="reaction-predictor-page"
      style={{
        maxWidth: layoutPreset.maxWidth,
        margin: '0 auto',
        padding: `0 ${layoutPreset.sidePadding}px`,
      }}
    >
      <Card variant="borderless" className="c-card compact-filter-card reaction-filter-card">
        <Row gutter={[12, 10]} align="middle">
          <Col flex="auto" style={{ minWidth: 0 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
                minWidth: 0,
              }}
            >
              <Segmented
                className="reaction-type-tabs"
                options={reactionTypeOptions}
                value={reactionType}
                onChange={(value) => {
                  setReactionType(value as ReactionType);
                  const firstRow = rows.find((row) => row.reactionType === value);
                  if (firstRow) setSelectedRowId(firstRow.id);
                }}
              />
              <Input
                prefix={<Search size={18} color={token.colorTextTertiary} />}
                placeholder="Search by SMILES or Name"
                className="v-search-input"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                style={{
                  flex: '1 1 260px',
                  minWidth: 180,
                  maxWidth: isSmall ? '100%' : 360,
                }}
              />
              <Button
                className="v-action-btn"
                icon={showFilters ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                onClick={() => setShowFilters((prev) => !prev)}
              >
                상세 필터 {showFilters ? '닫기' : '열기'}
              </Button>
              <Button
                className="v-action-btn"
                icon={<BenzeneIcon size={18} />}
                onClick={() => setIsStructureModalOpen(true)}
              >
                구조 검색
              </Button>
            </div>
          </Col>
        </Row>
        {showFilters && (
          <div className="compact-filter-panel">
            <Space wrap size={[8, 8]}>
              <Tag color="blue">Model: ΔG‡ site selectivity</Tag>
              <Tag color="geekblue">Catalyst: Pd default</Tag>
              <Tag color="purple">Solvent: inferred</Tag>
              <Tag>Mock data</Tag>
            </Space>
          </div>
        )}
      </Card>

      <Row gutter={[16, 16]} className="reaction-workspace-row">
        <Col xs={24} xl={16}>
          <div className="v-table-card reaction-calculation-card">
            <div className="v-table-header">
              <div>
                <Title level={4} style={{ margin: 0 }}>Home</Title>
                <Text type="secondary">Recent calculations</Text>
              </div>
              <Button
                type="primary"
                className="v-action-btn"
                icon={<Plus size={18} />}
                onClick={() => setIsPredictionModalOpen(true)}
              >
                Add prediction
              </Button>
            </div>
            <Table<ReactionPredictionRow>
              rowKey="id"
              columns={columns}
              dataSource={filteredRows}
              size="small"
              pagination={{
                defaultPageSize: 10,
                showSizeChanger: true,
                pageSizeOptions: [10, 30, 50, 100],
                itemRender: (page, type, originalElement) => (
                  type === 'page' ? <span>{formatNumberWithComma(page)}</span> : originalElement
                ),
              }}
              scroll={{ x: 850 }}
              rowClassName={(row) => (row.id === selectedRow?.id ? 'row-selected' : '')}
              onRow={(row) => ({
                onClick: () => setSelectedRowId(row.id),
              })}
            />
          </div>
        </Col>
        <Col xs={24} xl={8}>
          <div className="reaction-result-panel">
            {selectedRow ? (
              <>
                <Card className="c-card reaction-summary-card" variant="borderless">
                  <div className="reaction-section-title">
                    <Sparkles size={16} />
                    <span>ΔG‡OA Profile</span>
                  </div>
                  {selectedRow.status === 'calculating' ? (
                    <div className="reaction-profile-loading">
                      <Sparkles size={22} />
                      <Text strong>Calculating...</Text>
                      <Text type="secondary">ΔG‡OA profile is being generated.</Text>
                    </div>
                  ) : (
                    <div className="reaction-profile-image-frame">
                      <img
                        src={getReactionProfileImage(selectedRow)}
                        alt={`${selectedRow.name} ΔG‡OA profile`}
                      />
                    </div>
                  )}
                </Card>

                <Card className="c-card reaction-summary-card" variant="borderless">
                  <div className="reaction-section-title">
                    <CheckCircle2 size={16} />
                    <span>Why {selectedRow.majorSite} wins</span>
                  </div>
                  <Space direction="vertical" size={10} style={{ width: '100%' }}>
                    {(selectedRow.factors ?? []).map((factor) => (
                      <div className="reaction-factor-row" key={`${selectedRow.id}-${factor.label}`}>
                        <Tag>{factor.label}</Tag>
                        <div className="reaction-factor-copy">
                          <Text>{factor.detail}</Text>
                          <Progress
                            percent={factor.value}
                            showInfo={false}
                            strokeColor={factor.color}
                            trailColor={token.colorFillSecondary}
                          />
                        </div>
                        <Text strong>{factor.value}%</Text>
                      </div>
                    ))}
                  </Space>
                </Card>

                <Card className="c-card reaction-summary-card" variant="borderless">
                  <div className="reaction-section-title">
                    <ShieldCheck size={16} />
                    <span>Confidence Report</span>
                  </div>
                  {selectedRow.confidence ? (
                    <>
                      <div className="reaction-confidence-score">
                        <strong>{selectedRow.confidence.score}%</strong>
                        <span>{selectedRow.confidence.verdict} confidence</span>
                      </div>
                      <Space direction="vertical" size={8} style={{ width: '100%' }}>
                        {selectedRow.confidence.checks.map((check) => (
                          <div className="reaction-check-row" key={`${selectedRow.id}-${check.label}`}>
                            <span className={checkStatusMeta[check.status].className}>
                              {checkStatusMeta[check.status].label}
                            </span>
                            <Text strong>{check.label}</Text>
                            <Text type="secondary">{check.detail}</Text>
                          </div>
                        ))}
                      </Space>
                    </>
                  ) : (
                    <Alert type="info" showIcon message="Prediction is still calculating." />
                  )}
                </Card>
              </>
            ) : (
              <Card className="c-card reaction-summary-card" variant="borderless">
                <Alert type="info" showIcon message="Select a calculation to inspect prediction results." />
              </Card>
            )}
          </div>
        </Col>
      </Row>

      <Modal
        title="Prediction"
        open={isPredictionModalOpen}
        onCancel={() => setIsPredictionModalOpen(false)}
        width="min(1360px, calc(100vw - 48px))"
        footer={null}
        destroyOnHidden
      >
        <Row gutter={[24, 18]} className="reaction-prediction-modal">
          <Col xs={24} lg={16}>
            <div className="reaction-modal-section-title">STRUCTURE INPUT</div>
            <ChemDrawEditor
              active={isPredictionModalOpen}
              height={460}
              smilesValue={predictionSmiles}
              onSmilesChange={setPredictionSmiles}
              onReady={(editor) => {
                predictionEditorRef.current = editor;
              }}
              flipControlsPlacement="left"
            />
            <Text type="secondary" style={{ display: 'block', marginTop: 12 }}>Name</Text>
            <Input
              value={predictionName}
              onChange={(event) => setPredictionName(event.target.value)}
              placeholder="Prediction name"
              style={{ marginTop: 6 }}
            />
          </Col>
          <Col xs={24} lg={8}>
            <div className="reaction-modal-section-title">DETECTED C-X SITES</div>
            <Text type="secondary" style={{ display: 'block', marginBottom: 10 }}>
              자동 감지된 site를 검수하고 계산에 포함할 site를 선택합니다.
            </Text>
            <Table<ReactionSite>
              rowKey="site"
              size="small"
              pagination={false}
              dataSource={detectedSites}
              rowClassName={(site) => (site.enabled ? 'reaction-site-row-selected' : '')}
              onRow={(site) => ({
                onClick: () => handleSiteRowToggle(site.site),
              })}
              columns={[
                { title: 'Site', dataIndex: 'site', align: 'center' },
                { title: 'LG', dataIndex: 'leavingGroup', align: 'center' },
                {
                  title: 'Use',
                  dataIndex: 'enabled',
                  align: 'center',
                  render: (enabled: boolean, site) => (
                    <Checkbox
                      checked={enabled}
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) => handleSiteToggle(site.site, event.target.checked)}
                    />
                  ),
                },
              ]}
            />
            <Alert
              className="reaction-domain-alert"
              type="success"
              showIcon
              message="Domain check passed"
              description="3 reactive C-Br sites detected. Heteroaryl bromide in-domain."
            />
            <Button
              type="primary"
              block
              size="large"
              icon={<Sparkles size={18} />}
              onMouseDown={(event: React.MouseEvent<HTMLElement>) => {
                event.preventDefault();
                void predictionEditorRef.current?.__flushPendingInput?.();
              }}
              onClick={handleRunPrediction}
              disabled={!detectedSites.some((site) => site.enabled)}
            >
              Run ΔG‡{reactionType === 'oa' ? 'OA' : 'SNAr'} prediction
            </Button>
          </Col>
        </Row>
      </Modal>

      <ChemDrawModal
        open={isStructureModalOpen}
        onCancel={() => setIsStructureModalOpen(false)}
        onConfirm={handleStructureSearchConfirm}
        title="구조 검색"
        confirmText="이 구조로 검색"
      />
    </div>
  );
};

export default ReactionPredictor;
