import React, { useState } from 'react';
import {
  Row, Col, Card, Table, Button, Input, Checkbox,
  Space, Typography, Modal, Form, Tag, List, Select, DatePicker, Avatar, Divider, Upload, Segmented, theme
} from 'antd';
import {
  Search, Plus, Filter, Settings, List as ListIcon,
  Image as ImageIcon, GitBranch, FlaskConical, Info, ChevronDown, ChevronUp, Beaker,
  Activity, XCircle, Share2, GripVertical, Palette, Upload as UploadIcon, FileText
} from 'lucide-react';
import { useBoardStore } from '../store/useBoardStore';
import { mockCompounds, mockGroups } from '../mocks/compounds';
import RadarChart from '../components/charts/RadarChart';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

const MyBoard: React.FC = () => {
  const { token } = theme.useToken();
  const { selectedGroupIds, toggleGroupSelection, setSelectedSarCompoundIds } = useBoardStore();
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isDesignModalOpen, setIsDesignModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isStructureModalOpen, setIsStructureModalOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'draw' | 'tree'>('table');
  const [assignedGroupIds, setAssignedGroupIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDataSources, setSelectedDataSources] = useState<string[]>(['my designs']);

  const getViewToggleButtonStyle = (mode: 'table' | 'draw' | 'tree'): React.CSSProperties => {
    const isActive = viewMode === mode;

    return {
      background: isActive ? token.colorPrimaryBg : 'transparent',
      border: `1px solid ${isActive ? token.colorPrimary : 'transparent'}`,
      color: isActive ? token.colorPrimary : token.colorTextSecondary,
      borderRadius: 6,
      fontSize: 11,
      fontWeight: isActive ? 600 : 500,
      boxShadow: isActive ? '0 0 0 1px rgba(248, 124, 99, 0.15)' : 'none'
    };
  };

  // Sync selectedGroupIds to local state when modal opens
  React.useEffect(() => {
    if (isDesignModalOpen) {
      setAssignedGroupIds(selectedGroupIds);
    }
  }, [isDesignModalOpen, selectedGroupIds]);

  // COLUMN STATES (Order & Visibility)
  const [columnOrder, setColumnOrder] = useState<string[]>([
    'Num', 'Grp.', 'Compound', 'Structure', 'Name', 'Source', 'Memo', 'Mol.Props1', 'Mol.Props2', '계산'
  ]);
  const [activeColumns, setActiveColumns] = useState<string[]>([
    'Num', 'Grp.', 'Compound', 'Structure', 'Name', 'Source', 'Memo', 'Mol.Props1', 'Mol.Props2', '계산'
  ]);

  // Preset State: stores order and active columns for each preset index (1-5)
  const defaultOrder = ['Num', 'Grp.', 'Compound', 'Structure', 'Name', 'Source', 'Memo', 'Mol.Props1', 'Mol.Props2', '계산'];
  const defaultActive = ['Num', 'Grp.', 'Compound', 'Structure', 'Name', 'Source', 'Memo', 'Mol.Props1', 'Mol.Props2', '계산'];
  const [activePreset, setActivePreset] = useState<number>(1);
  const [presets, setPresets] = useState<Record<number, any>>({
    1: { order: [...defaultOrder], active: [...defaultActive] },
    2: { order: [...defaultOrder], active: [...defaultActive] },
    3: { order: [...defaultOrder], active: [...defaultActive] },
    4: { order: [...defaultOrder], active: [...defaultActive] },
    5: { order: [...defaultOrder], active: [...defaultActive] }
  });

  const handleSavePreset = () => {
    setPresets({
      ...presets,
      [activePreset]: { order: [...columnOrder], active: [...activeColumns] }
    });
    setIsSettingsModalOpen(false);
  };

  const applyPreset = (n: number) => {
    setActivePreset(n);
    const preset = presets[n];
    if (preset) {
      setColumnOrder([...preset.order]);
      setActiveColumns([...preset.active]);
    }
  };

  const toggleColumn = (key: string) => {
    setActiveColumns(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  // Filter States
  const projectList = ['FGFR', 'C797S DM', 'cMET', 'VRK1', 'HER2', 'WRN', 'WEE1'];
  const shareList = ['내 물질', '공유함', '공유받음'];
  const sourceList = ['내 머리', '동료 머리', 'Patent', 'Paper', 'FBDD', 'ELN'];
  const [selectedProjects, setSelectedProjects] = useState<string[]>(['ALL', ...projectList]);
  const [selectedShares, setSelectedShares] = useState<string[]>(['ALL', ...shareList]);
  const [selectedSources, setSelectedSources] = useState<string[]>(['ALL', ...sourceList]);
  const [period, setPeriod] = useState<string>('전체');
  const [keyword, setKeyword] = useState<string>('');

  const handleCheckboxChange = (vals: string[], setFn: (v: string[]) => void, originalOptions: string[]) => {
    const isMainOptionsSelected = originalOptions.every(opt => vals.includes(opt));
    const previouslyHadAll = (setFn === setSelectedProjects ? selectedProjects :
      setFn === setSelectedShares ? selectedShares :
        selectedSources).includes('ALL');
    const currentlyHasAll = vals.includes('ALL');

    if (currentlyHasAll && !previouslyHadAll) {
      setFn(['ALL', ...originalOptions]);
    } else if (!currentlyHasAll && previouslyHadAll) {
      setFn([]);
    } else {
      const filteredVals = vals.filter(v => v !== 'ALL');
      if (filteredVals.length === originalOptions.length) {
        setFn(['ALL', ...originalOptions]);
      } else {
        setFn(filteredVals);
      }
    }
  };

  const filteredCompounds = mockCompounds.filter(c => {
    if (selectedGroupIds.length > 0 && !selectedGroupIds.includes(c.groupId)) return false;
    if (!selectedProjects.includes('ALL') && c.project && !selectedProjects.includes(c.project)) return false;
    if (!selectedShares.includes('ALL') && c.shareStatus && !selectedShares.includes(c.shareStatus)) return false;
    if (!selectedSources.includes('ALL') && c.designSource && !selectedSources.includes(c.designSource)) return false;
    if (keyword && !c.name.includes(keyword) && !c.smiles.includes(keyword)) return false;
    return true;
  });

  const sarTargetCount = selectedGroupIds.length > 0 ? filteredCompounds.length : 0;

  const groupColumns = [
    {
      title: '',
      key: 'selection',
      width: 40,
      render: (record: any) => (
        <Checkbox
          checked={selectedGroupIds.includes(record.id)}
          onChange={() => {
            setIsLoading(true);
            toggleGroupSelection(record.id);
            setTimeout(() => setIsLoading(false), 500); // Simulate loading
          }}
        />
      )
    },
    { title: 'Date', dataIndex: 'creDate', key: 'creDate', width: 100 },
    { title: 'Type', dataIndex: 'type', key: 'type', width: 100 },
    { title: 'Target', dataIndex: 'target', key: 'target', width: 80, render: (t: string) => <Tag color="blue">{t}</Tag> },
    { title: 'Title', dataIndex: 'name', key: 'name' },
    {
      title: '공유',
      dataIndex: 'shareStatus',
      key: 'shareStatus',
      render: (status: string) => (
        status === '공유함' ? <Button size="small" type="text" danger icon={<XCircle size={14} />}>공유취소</Button> : null
      )
    },
    { title: '개수', dataIndex: 'count', key: 'count', align: 'right' as const, width: 60 }
  ];

  const allColumnsMap: Record<string, any> = {
    'Num': { title: 'Num', key: 'num', render: (_: any, __: any, index: number) => index + 1, width: 50 },
    'Grp.': { title: 'Grp.', dataIndex: 'groupId', key: 'groupId', width: 60 },
    'Compound': { title: 'Compound', dataIndex: 'compoundId', key: 'compoundId', width: 100, render: (id: string) => <Text strong color={token.colorPrimary}>{id}</Text> },
    'Structure': {
      title: 'Structure',
      dataIndex: 'smiles',
      key: 'structure',
      width: 120,
      render: () => (
        <div style={{ width: 100, height: 60, background: token.colorBgLayout, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4, border: `1px solid ${token.colorBorderSecondary}` }}>
          <FlaskConical size={20} color={token.colorTextTertiary} />
        </div>
      )
    },
    'Name': { title: 'Name', dataIndex: 'name', key: 'name', ellipsis: true },
    'Source': { title: 'Source', dataIndex: 'designSource', key: 'designSource', width: 100 },
    'Memo': { title: 'Memo', dataIndex: 'memo', key: 'memo', ellipsis: true, width: 200 },
    'Mol.Props1': {
      title: 'Mol.Props1',
      dataIndex: 'properties1',
      key: 'props1',
      width: 100,
      render: (props: number[]) => props ? <RadarChart data={props} size={60} /> : '-'
    },
    'Mol.Props2': {
      title: 'Mol.Props2',
      dataIndex: 'properties2',
      key: 'props2',
      width: 100,
      render: (props: number[]) => props ? <RadarChart data={props} size={60} color="#5856d6" /> : '-'
    },
    '계산': {
      title: '계산',
      dataIndex: 'requiredCalcs',
      key: 'calcs',
      render: (calcs: string[]) => (
        <Space size={[0, 4]} wrap>
          {calcs?.map(c => <Tag key={c}>{c}</Tag>)}
        </Space>
      )
    }
  };

  const dynamicCompoundColumns = columnOrder
    .filter(key => activeColumns.includes(key))
    .map(key => allColumnsMap[key])
    .filter(Boolean);

  // DRAG AND DROP LOGIC
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);

  const onDragStart = (index: number) => {
    setDraggedItemIndex(index);
  };

  const onDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedItemIndex === null || draggedItemIndex === index) return;

    const newOrder = [...columnOrder];
    const draggedItem = newOrder[draggedItemIndex];
    newOrder.splice(draggedItemIndex, 1);
    newOrder.splice(index, 0, draggedItem);

    setDraggedItemIndex(index);
    setColumnOrder(newOrder);
  };

  const onDragEnd = () => {
    setDraggedItemIndex(null);
  };

  return (
    <div className="gx-main-content">
      {/* Search Header */}
      <Card variant="borderless" className="c-card" style={{ marginBottom: 24, borderRadius: 12 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col flex="auto">
            <Space size="middle">
              <Input
                prefix={<Search size={18} color={token.colorTextTertiary} />}
                placeholder="검색어 입력 (이름, SMILES 등)"
                style={{ width: 350, height: 44, borderRadius: 12 }}
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
              <Button
                icon={showFilters ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                onClick={() => setShowFilters(!showFilters)}
                style={{ height: 44, borderRadius: 12 }}
              >
                상세 필터 {showFilters ? '닫기' : '열기'}
              </Button>
              <Button icon={<Beaker size={18} />} onClick={() => setIsStructureModalOpen(true)} style={{ height: 44, borderRadius: 12 }}>구조 검색</Button>
            </Space>
          </Col>
          <Col>
            <Space>
              <Button type="primary" icon={<Plus size={18} />} onClick={() => setIsGroupModalOpen(true)} style={{ height: 44, borderRadius: 12, background: token.colorPrimary, borderColor: token.colorPrimary }}>상위 그룹 생성</Button>
            </Space>
          </Col>
        </Row>
        {showFilters && (
          <div style={{ marginTop: 24, padding: 20, background: token.colorBgLayout, borderRadius: 12 }}>
            <Row gutter={[32, 24]}>
              <Col span={10}>
                <Text strong>Projects</Text><br />
                <Checkbox.Group options={['ALL', ...projectList]} value={selectedProjects} onChange={(v) => handleCheckboxChange(v as string[], setSelectedProjects, projectList)} />
              </Col>
              <Col span={6}>
                <Text strong>Share</Text><br />
                <Checkbox.Group options={['ALL', ...shareList]} value={selectedShares} onChange={(v) => handleCheckboxChange(v as string[], setSelectedShares, shareList)} />
              </Col>
              <Col span={8}>
                <Text strong>Design Source</Text><br />
                <Checkbox.Group options={['ALL', ...sourceList]} value={selectedSources} onChange={(v) => handleCheckboxChange(v as string[], setSelectedSources, sourceList)} />
              </Col>
              <Col span={24}>
                <Space size="large">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Text strong>기간:</Text>
                    <Segmented options={['3개월', '6개월', '12개월', '전체']} value={period} onChange={(v) => setPeriod(v as string)} />
                    <RangePicker
                      style={{ borderRadius: 8 }}
                      disabled={period !== '전체'}
                    />
                  </div>
                </Space>
              </Col>
            </Row>
          </div>
        )}
      </Card>

      <Row gutter={[24, 24]}>
        <Col span={10}>
          <div className="c-card" style={{ background: token.colorBgContainer, borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '16px 24px', borderBottom: `1px solid ${token.colorBorderSecondary}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text strong style={{ color: token.colorPrimary }}>그룹 리스트</Text>
              <Space size="middle">
                <Button
                  size="small"
                  icon={<Beaker size={14} />}
                  onClick={() => {
                    (window as any).onNavigate?.('synthesis-board');
                  }}
                >
                  합성 보드
                </Button>
                <div style={{ background: token.colorBgLayout, padding: '4px 8px', borderRadius: 8, display: 'flex', gap: 12, alignItems: 'center' }}>
                <Checkbox
                  checked={selectedDataSources.includes('my designs')}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...selectedDataSources, 'my designs']
                      : selectedDataSources.filter(s => s !== 'my designs');
                    if (next.length > 0) setSelectedDataSources(next);
                  }}
                >
                  <Text style={{ fontSize: 11 }}>My Designs</Text>
                </Checkbox>
                <Checkbox
                  checked={selectedDataSources.includes('my compounds')}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...selectedDataSources, 'my compounds']
                      : selectedDataSources.filter(s => s !== 'my compounds');
                    if (next.length > 0) setSelectedDataSources(next);
                  }}
                >
                  <Text style={{ fontSize: 11 }}>My Compounds</Text>
                </Checkbox>
              </div>
              </Space>
            </div>
            <Table
              dataSource={mockGroups.filter(g => selectedDataSources.includes(g.type))}
              columns={groupColumns}
              pagination={false}
              size="small"
              rowKey="id"
            />
          </div>
        </Col>

        <Col span={14}>
          <div className="c-card" style={{ background: token.colorBgContainer, borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '16px 24px', borderBottom: `1px solid ${token.colorBorderSecondary}`, display: 'flex', justifyContent: 'space-between' }}>
              <Text strong style={{ color: token.colorPrimary }}>그룹 상세 목록</Text>
              <Space>
                <Button
                  type="primary"
                  size="small"
                  icon={<Plus size={14} />}
                  disabled={selectedGroupIds.length === 0}
                  style={{ background: token.colorPrimary, borderColor: token.colorPrimary }}
                  onClick={() => setIsDesignModalOpen(true)}
                >
                  Create Design
                </Button>
                <Button
                  type="primary"
                  size="small"
                  icon={<Share2 size={14} />}
                  disabled={sarTargetCount === 0}
                  style={{ background: token.colorPrimary, borderColor: token.colorPrimary }}
                  onClick={() => {
                    setSelectedSarCompoundIds(filteredCompounds.map((compound) => compound.id));
                    (window as any).onNavigate?.('sar-table');
                  }}
                >
                  SAR Table로 보기 ({sarTargetCount})
                </Button>
                {viewMode === 'table' && (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {[1, 2, 3, 4, 5].map(n => (
                          <div 
                            key={n} 
                            onClick={() => applyPreset(n)}
                            style={{ 
                              width: 24, height: 24, 
                              background: activePreset === n ? token.colorPrimary : token.colorBorderSecondary, 
                              borderRadius: 4, 
                              fontSize: 11, 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center', 
                              color: activePreset === n ? token.colorBgContainer : token.colorTextSecondary,
                              cursor: 'pointer',
                              fontWeight: activePreset === n ? 'bold' : 'normal',
                              transition: 'all 0.2s'
                            }}
                          >
                            {n}
                          </div>
                        ))}
                      </div>
                      <Settings 
                        size={18} 
                        color={token.colorTextTertiary} 
                        style={{ cursor: 'pointer' }} 
                        onClick={() => setIsSettingsModalOpen(true)}
                      />
                    </div>
                    <Divider type="vertical" />
                  </>
                )}
                <div
                  style={{
                    background: token.colorBgLayout,
                    padding: '2px',
                    borderRadius: 8,
                    display: 'flex',
                    border: `1px solid ${token.colorBorderSecondary}`
                  }}
                >
                  <Button
                    type="text"
                    size="small"
                    icon={<ListIcon size={14} />}
                    style={getViewToggleButtonStyle('table')}
                    onClick={() => setViewMode('table')}
                  >
                    Table
                  </Button>
                  <Button
                    type="text"
                    size="small"
                    icon={<ImageIcon size={14} />}
                    style={getViewToggleButtonStyle('draw')}
                    onClick={() => setViewMode('draw')}
                  >
                    Canvas
                  </Button>
                  <Button
                    type="text"
                    size="small"
                    icon={<GitBranch size={14} />}
                    style={getViewToggleButtonStyle('tree')}
                    onClick={() => setViewMode('tree')}
                  >
                    Tree
                  </Button>
                </div>
              </Space>
            </div>
            {viewMode === 'table' ? (
              <Table
                dataSource={selectedGroupIds.length > 0 ? filteredCompounds : []}
                columns={dynamicCompoundColumns}
                size="small"
                rowKey="id"
                pagination={{ pageSize: 8 }}
                loading={isLoading}
                locale={{ emptyText: selectedGroupIds.length === 0 ? '왼쪽 그룹 리스트에서 그룹을 선택해 주세요.' : '검색 결과가 없습니다.' }}
              />
            ) : viewMode === 'draw' ? (
              <div style={{ padding: 20, minHeight: 400 }}>
                {selectedGroupIds.length === 0 ? (
                  <div style={{ height: 360, display: 'flex', alignItems: 'center', justifyContent: 'center', color: token.colorTextTertiary }}>
                    왼쪽 그룹 리스트에서 그룹을 선택해 주세요.
                  </div>
                ) : filteredCompounds.length === 0 ? (
                  <div style={{ height: 360, display: 'flex', alignItems: 'center', justifyContent: 'center', color: token.colorTextTertiary }}>
                    검색 결과가 없습니다.
                  </div>
                ) : (
                  <Row gutter={[16, 16]}>
                    {filteredCompounds.map(c => (
                      <Col span={6} key={c.id}>
                        <div style={{
                          border: `1px solid ${token.colorBorderSecondary}`,
                          borderRadius: 8,
                          overflow: 'hidden',
                          transition: 'all 0.3s ease',
                          cursor: 'pointer'
                        }}
                          className="canvas-card"
                        >
                          <div style={{ padding: '8px 12px', background: token.colorBgLayout, borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
                            <Text strong style={{ color: token.colorPrimary, fontSize: 12 }}>{c.compoundId}</Text>
                          </div>
                          <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', background: token.colorBgContainer }}>
                            <FlaskConical size={32} color={token.colorBorder} />
                          </div>
                        </div>
                      </Col>
                    ))}
                  </Row>
                )}
              </div>
            ) : (
              <div style={{ padding: 40, textAlign: 'center', color: token.colorTextTertiary }}>Tree View 준비 중...</div>
            )}
          </div>
        </Col>
      </Row>

      {/* Create Group Modal */}
      <Modal
        title="상위 그룹 생성"
        open={isGroupModalOpen}
        onCancel={() => setIsGroupModalOpen(false)}
        onOk={() => setIsGroupModalOpen(false)}
        okText="생성"
        cancelText="취소"
      >
        <Form layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="그룹 이름" required>
            <Input placeholder="그룹 이름을 입력하세요" />
          </Form.Item>
          <Form.Item label="타겟/프로젝트">
            <Select placeholder="타켓 선택">
              {projectList.map(p => <Option key={p} value={p}>{p}</Option>)}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* Create Design Modal */}
      <Modal
        title="디자인 등록 (Create Design)"
        open={isDesignModalOpen}
        onCancel={() => setIsDesignModalOpen(false)}
        onOk={() => setIsDesignModalOpen(false)}
        okText="등록"
        cancelText="취소"
        width={800}
        style={{ top: 40 }}
      >
        <Form layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item label="Group" tooltip="선택된 그룹이 자동 지정됩니다.">
                <Select
                  mode="multiple"
                  placeholder="그룹 선택"
                  value={assignedGroupIds}
                  onChange={(ids) => {
                    setAssignedGroupIds(ids);
                  }}
                >
                  {mockGroups.map(g => <Option key={g.id} value={g.id}>{g.name}</Option>)}
                </Select>
              </Form.Item>
              <Form.Item label="Name" required rules={[{ required: true, message: '이름을 입력해주세요' }]}>
                <Input placeholder="디자인 이름을 입력하세요 (예: VNA-12345)" />
              </Form.Item>
              <Form.Item label="Source" required rules={[{ required: true, message: '출처를 선택하거나 입력해주세요' }]}>
                <Select placeholder="출처 선택" showSearch allowClear>
                  {sourceList.map(s => <Option key={s} value={s}>{s}</Option>)}
                </Select>
              </Form.Item>
              <Form.Item label="SMILES" required rules={[{ required: true, message: 'SMILES 상식을 입력해주세요' }]}>
                <Input.TextArea
                  rows={3}
                  placeholder="SMILES 문자열을 입력하세요"
                  onChange={(e) => {
                    // SMILES 입력 시 Draw 영역 시뮬레이션
                    console.log('SMILES change:', e.target.value);
                  }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Draw (Structure)" required style={{ marginBottom: 0 }}>
                <div style={{
                  height: 250,
                  background: '#fcfcfc',
                  borderRadius: 8,
                  border: `1px solid ${token.colorBorderSecondary}`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  <div style={{ position: 'absolute', top: 8, right: 8 }}>
                    <Button size="small" icon={<Palette size={14} />}>Editor 열기</Button>
                  </div>
                  <FlaskConical size={64} color={token.colorPrimary} style={{ opacity: 0.2 }} />
                  <Text type="secondary" style={{ marginTop: 12 }}>ChemDraw Editor 연동 예정</Text>
                  <Text style={{ color: token.colorTextTertiary, fontSize: '11px' }}>SMILES 입력 시 구조가 자동 생성됩니다.</Text>
                </div>
              </Form.Item>
            </Col>
          </Row>

          <Divider style={{ margin: '24px 0 16px 0' }} />

          <Form.Item label={<Text strong><Activity size={14} style={{ marginRight: 6 }} />Calculations (다중 선택)</Text>}>
            <Checkbox.Group style={{ width: '100%', background: token.colorBgLayout, padding: '16px', borderRadius: 8 }}>
              <Row gutter={[16, 12]}>
                {[
                  '3D TPSA QM', 'Solubility QM', 'Solubility DL', 'E-Sol QM',
                  'Permeability MD', '특허성', '합성기능성'
                ].map(item => (
                  <Col span={8} key={item}>
                    <Checkbox value={item}>{item}</Checkbox>
                  </Col>
                ))}
              </Row>
            </Checkbox.Group>
            <Text type="secondary" style={{ fontSize: '12px', marginTop: 8, display: 'block' }}>
              * 체크된 항목은 API를 통해 계산 결과가 리포트에 포함됩니다.
            </Text>
          </Form.Item>

          <Form.Item label="Memo (Notes)">
            <Input.TextArea rows={2} placeholder="디자인 의도나 참고 사항을 입력하세요" />
          </Form.Item>

          <Form.Item label="Attachment (첨부파일)">
            <Upload.Dragger multiple showUploadList={true} beforeUpload={() => false}>
              <p className="ant-upload-drag-icon" style={{ color: token.colorPrimary }}>
                <UploadIcon size={32} />
              </p>
              <p className="ant-upload-text">파일을 클릭하거나 이 영역으로 드래그하여 업로드하세요</p>
              <p className="ant-upload-hint">실험 데이터, 문서 또는 관련 이미지 등 디자인을 보충할 파일을 첨부할 수 있습니다.</p>
            </Upload.Dragger>
          </Form.Item>
        </Form>
      </Modal>

      {/* Settings Modal (Interactive DND) */}
      <Modal
        title="테이블 컬럼 설정 (드래그하여 순서 변경)"
        open={isSettingsModalOpen}
        onCancel={() => setIsSettingsModalOpen(false)}
        footer={[
          <Button key="save" type="primary" onClick={handleSavePreset} style={{ background: token.colorPrimary, borderColor: token.colorPrimary, marginRight: 8 }}>
            {activePreset}번 프리셋에 저장
          </Button>,
          <Button key="ok" type="default" onClick={() => setIsSettingsModalOpen(false)}>완료</Button>
        ]}
      >
        <div style={{ padding: '10px 0' }}>
          <div style={{ marginBottom: 24 }}>
            <Text strong style={{ display: 'block', marginBottom: 12 }}>설정 프리셋 선택</Text>
            <div style={{ display: 'flex', gap: 12 }}>
              {[1, 2, 3, 4, 5].map(n => (
                <Button 
                  key={n}
                  type={activePreset === n ? 'primary' : 'default'}
                  onClick={() => applyPreset(n)}
                  style={{ 
                    width: 44, height: 44, borderRadius: 8,
                    background: activePreset === n ? token.colorPrimary : token.colorBgContainer,
                    borderColor: activePreset === n ? token.colorPrimary : token.colorBorder,
                    color: activePreset === n ? token.colorBgContainer : 'inherit'
                  }}
                >
                  {n}
                </Button>
              ))}
            </div>
          </div>
          <Text strong style={{ display: 'block', marginBottom: 16 }}>Column Order & Visibility</Text>
          {columnOrder.map((item, index) => (
            <div
              key={item}
              draggable
              onDragStart={() => onDragStart(index)}
              onDragOver={(e) => onDragOver(e, index)}
              onDragEnd={onDragEnd}
              style={{
                padding: '12px 16px',
                marginBottom: 8,
                background: draggedItemIndex === index ? token.colorPrimaryBg : token.colorBgContainer,
                border: draggedItemIndex === index ? `1px dashed ${token.colorBorderSecondary}` : `1px solid ${token.colorBorderSecondary}`,
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'grab',
                opacity: draggedItemIndex === index ? 0.6 : 1,
                transition: 'all 0.2s ease',
                boxShadow: draggedItemIndex === index ? '0 4px 12px rgba(248, 124, 99, 0.1)' : 'none'
              }}
            >
              <Space>
                <GripVertical size={16} color={token.colorTextTertiary} />
                <Text strong={draggedItemIndex === index}>{item}</Text>
              </Space>
              <Checkbox
                checked={activeColumns.includes(item)}
                onChange={() => toggleColumn(item)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          ))}
        </div>
        <div style={{ marginTop: 16, padding: '12px', background: token.colorBgLayout, borderRadius: 8 }}>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            <Info size={12} style={{ marginRight: 4 }} />
            목록을 마우스로 끌어서 테이블 컬럼의 표시 순서를 변경할 수 있습니다.
          </Text>
        </div>
      </Modal>

      {/* Chemdraw Modal Placeholder */}
      <Modal title="구조 검색 (Chemdraw)" open={isStructureModalOpen} onCancel={() => setIsStructureModalOpen(false)} footer={null} width={800}>
        <div style={{ height: 400, background: token.colorBgLayout, borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: `2px dashed ${token.colorBorderSecondary}` }}>
          <FlaskConical size={48} color={token.colorTextTertiary} />
          <Text type="secondary" style={{ marginTop: 16 }}>Chemdraw Editor 공간 확보 (모의 이미지 사용 예정)</Text>
        </div>
      </Modal>
    </div>
  );
};

export default MyBoard;
