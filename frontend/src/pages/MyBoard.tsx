import React, { useState } from 'react';
import {
  Row, Col, Card, Table, Button, Input, Checkbox,
  Space, Typography, Modal, Form, Tag, List, Select, DatePicker, Avatar, Divider, Upload, Segmented
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
  const { selectedGroupIds, toggleGroupSelection } = useBoardStore();
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isDesignModalOpen, setIsDesignModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isStructureModalOpen, setIsStructureModalOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'draw' | 'tree'>('table');
  const [assignedGroupIds, setAssignedGroupIds] = useState<string[]>([]);

  // Sync selectedGroupIds to local state when modal opens
  React.useEffect(() => {
    if (isDesignModalOpen) {
      setAssignedGroupIds(selectedGroupIds);
    }
  }, [isDesignModalOpen, selectedGroupIds]);

  // COLUMN STATES (Order & Visibility)
  const [columnOrder, setColumnOrder] = useState<string[]>([
    'Num', 'Grp.', 'Compound', 'Structure', 'Name', 'Source', 'Mol.Props1', 'Mol.Props2', '계산'
  ]);
  const [activeColumns, setActiveColumns] = useState<string[]>([
    'Num', 'Grp.', 'Compound', 'Structure', 'Name', 'Source', 'Mol.Props1', 'Mol.Props2', '계산'
  ]);

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

  const groupColumns = [
    {
      title: '',
      key: 'selection',
      width: 40,
      render: (record: any) => (
        <Checkbox
          checked={selectedGroupIds.includes(record.id)}
          onChange={() => toggleGroupSelection(record.id)}
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
    'Compound': { title: 'Compound', dataIndex: 'compoundId', key: 'compoundId', width: 100, render: (id: string) => <Text strong color="#F87C63">{id}</Text> },
    'Structure': {
      title: 'Structure',
      dataIndex: 'smiles',
      key: 'structure',
      width: 120,
      render: () => (
        <div style={{ width: 100, height: 60, background: '#f9f9f9', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4, border: '1px solid #eee' }}>
          <FlaskConical size={20} color="#ccc" />
        </div>
      )
    },
    'Name': { title: 'Name', dataIndex: 'name', key: 'name', ellipsis: true },
    'Source': { title: 'Source', dataIndex: 'designSource', key: 'designSource', width: 100 },
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
          {calcs?.map(c => <Tag key={c} size="small">{c}</Tag>)}
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
                prefix={<Search size={18} color="#adb5bd" />}
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
              <Button type="primary" icon={<Plus size={18} />} onClick={() => setIsGroupModalOpen(true)} style={{ height: 44, borderRadius: 12, background: '#F87C63', borderColor: '#F87C63' }}>상위 그룹 생성</Button>
              <Button icon={<Plus size={18} />} onClick={() => setIsDesignModalOpen(true)} style={{ height: 44, borderRadius: 12 }}>Create Design</Button>
            </Space>
          </Col>
        </Row>
        {showFilters && (
          <div style={{ marginTop: 24, padding: 20, background: '#f8f9fa', borderRadius: 12 }}>
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
          <div className="c-card" style={{ background: '#fff', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #f0f0f0' }}>
              <Text strong style={{ color: '#F87C63' }}>그룹 리스트</Text>
            </div>
            <Table dataSource={mockGroups} columns={groupColumns} pagination={false} size="small" rowKey="id" />
          </div>
        </Col>

        <Col span={14}>
          <div className="c-card" style={{ background: '#fff', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between' }}>
              <Text strong style={{ color: '#F87C63' }}>데이터 목록</Text>
              <Space>
                <Button size="small" icon={<Settings size={14} />} onClick={() => setIsSettingsModalOpen(true)}>Settings</Button>
              </Space>
            </div>
            <Table dataSource={filteredCompounds} columns={dynamicCompoundColumns} size="small" rowKey="id" pagination={{ pageSize: 8 }} />
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
                  border: '1px solid #d9d9d9',
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
                  <FlaskConical size={64} color="#F87C63" style={{ opacity: 0.2 }} />
                  <Text type="secondary" style={{ marginTop: 12 }}>ChemDraw Editor 연동 예정</Text>
                  <Text size="small" style={{ color: '#adb5bd', fontSize: '11px' }}>SMILES 입력 시 구조가 자동 생성됩니다.</Text>
                </div>
              </Form.Item>
            </Col>
          </Row>

          <Divider style={{ margin: '24px 0 16px 0' }} />

          <Form.Item label={<Text strong><Activity size={14} style={{ marginRight: 6 }} />Calculations (다중 선택)</Text>}>
            <Checkbox.Group style={{ width: '100%', background: '#f8f9fa', padding: '16px', borderRadius: 8 }}>
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
              <p className="ant-upload-drag-icon" style={{ color: '#F87C63' }}>
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
        footer={[<Button key="ok" type="primary" onClick={() => setIsSettingsModalOpen(false)}>완료</Button>]}
      >
        <div style={{ padding: '10px 0' }}>
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
                background: draggedItemIndex === index ? '#fff7f6' : '#fff',
                border: draggedItemIndex === index ? '1px dashed #F87C63' : '1px solid #f0f0f0',
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
                <GripVertical size={16} color="#adb5bd" />
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
        <div style={{ marginTop: 16, padding: '12px', background: '#f8f9fa', borderRadius: 8 }}>
          <Text type="secondary" size="small">
            <Info size={12} style={{ marginRight: 4 }} />
            목록을 마우스로 끌어서 테이블 컬럼의 표시 순서를 변경할 수 있습니다.
          </Text>
        </div>
      </Modal>

      {/* Ketcher Modal Placeholder */}
      <Modal title="구조 검색 (Ketcher)" open={isStructureModalOpen} onCancel={() => setIsStructureModalOpen(false)} footer={null} width={800}>
        <div style={{ height: 400, background: '#f5f5f5', borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '2px dashed #ddd' }}>
          <FlaskConical size={48} color="#ccc" />
          <Text type="secondary" style={{ marginTop: 16 }}>Ketcher Editor 공간 확보 (모의 이미지 사용 예정)</Text>
        </div>
      </Modal>
    </div>
  );
};

export default MyBoard;
