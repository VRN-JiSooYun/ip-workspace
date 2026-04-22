import React, { useState, useMemo } from 'react';
import {
  Row, Col, Card, Table, Button, Input, Checkbox,
  Space, Typography, Modal, Form, Tag, Select, DatePicker, Avatar, Divider, Segmented, Popover, theme
} from 'antd';
import {
  Search, Plus, Filter, Settings, FlaskConical, Info, ChevronDown, ChevronUp, Beaker, Image as ImageIcon, GitBranch,
  UserPlus, CheckCircle2, Clock, AlertCircle, GripVertical, Users, Activity, List as ListIcon
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

interface SynthesisDetail {
  id: string;
  groupId: string;
  groupNum: number;
  compoundId: string;
  name: string;
  smiles: string;
  assignee: string | null;
  requestDate: string;
  completeDate: string | null;
}

const ManagerComparisonPopup = ({ record, currentMgrName }: { record: any, currentMgrName?: string }) => {
  const { token } = theme.useToken();
  return (
  <div style={{ minWidth: 300 }}>
    <div style={{ marginBottom: 12, borderBottom: `1px solid ${token.colorBorderSecondary}`, paddingBottom: 8 }}>
      <div style={{ marginBottom: 4 }}>
        <Text strong style={{ fontSize: 14, color: token.colorPrimary }}>{record.title}</Text>
      </div>
      <Text style={{ fontSize: 12, color: token.colorTextSecondary }}>담당자별 합성 현황 비교</Text>
    </div>
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
          <th style={{ textAlign: 'left', padding: '4px 0', fontSize: 11, color: token.colorTextSecondary }}>담당자</th>
          <th style={{ textAlign: 'center', padding: '4px 0', fontSize: 11, color: token.colorTextSecondary }}>합성중</th>
          <th style={{ textAlign: 'center', padding: '4px 0', fontSize: 11, color: token.colorTextSecondary }}>완료</th>
          <th style={{ textAlign: 'center', padding: '4px 0', fontSize: 11, color: token.colorTextSecondary }}>합계</th>
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: 6 }).map((_, idx) => {
          const managerName = `담당자${idx + 1}`;
          const m = record.managers.find((mgrObj: any) => mgrObj.name === managerName) ||
            { name: managerName, count: 0, ing: 0, done: 0 };

          return (
            <tr key={idx} style={{ background: m.name === currentMgrName ? token.colorPrimaryBg : 'transparent' }}>
              <td style={{ padding: '6px 0', fontSize: 12 }}>
                <Text strong={m.name === currentMgrName}>{m.name}</Text>
              </td>
              <td style={{ textAlign: 'center', fontSize: 11, color: '#1890ff' }}>{m.ing}</td>
              <td style={{ textAlign: 'center', fontSize: 11, color: '#52c41a' }}>{m.done}</td>
              <td style={{ textAlign: 'center', fontSize: 11, fontWeight: 600 }}>{m.count}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
  );
};

const SynthesisBoard: React.FC = () => {
  const { token } = theme.useToken();
  const { isDarkMode } = useTheme();
  const [selectedDataSources, setSelectedDataSources] = useState<string[]>(['Designs']);
  const [showFilters, setShowFilters] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>('sg1');
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SynthesisDetail | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'draw' | 'tree'>('table');

  // Filter States (Sync with MyBoard)
  const projectList = ['FGFR', 'C797S DM', 'cMET', 'VRK1', 'HER2', 'WRN', 'WEE1'];
  const shareList = ['내 물질', '공유함', '공유받음'];
  const sourceList = ['내 머리', '동료 머리', 'Patent', 'Paper', 'FBDD', 'ELN'];

  const [selectedProjects, setSelectedProjects] = useState<string[]>(['ALL', ...projectList]);
  const [selectedShares, setSelectedShares] = useState<string[]>(['ALL', ...shareList]);
  const [selectedSources, setSelectedSources] = useState<string[]>(['ALL', ...sourceList]);
  const [period, setPeriod] = useState<string>('전체');

  const handleCheckboxChange = (vals: string[], setFn: (v: string[]) => void, originalOptions: string[]) => {
    const currentlyHasAll = vals.includes('ALL');
    const previouslyHadAll = (setFn === setSelectedProjects ? selectedProjects :
      setFn === setSelectedShares ? selectedShares :
        selectedSources).includes('ALL');

    if (currentlyHasAll && !previouslyHadAll) {
      setFn(['ALL', ...originalOptions]);
    } else if (!currentlyHasAll && previouslyHadAll) {
      setFn([]);
    } else {
      const filtered = vals.filter(v => v !== 'ALL');
      if (filtered.length === originalOptions.length) {
        setFn(['ALL', ...originalOptions]);
      } else {
        setFn(filtered);
      }
    }
  };

  // Mock Data for Designs
  const designGroups = [
    {
      id: 'sg1', num: 1, date: '2026-04-10', type: 'My Designs', target: 'FGFR', title: 'Leucine series A',
      share: '공유함', ing: 2, done: 1, unassigned: 2, total: 5,
      managers: [
        { name: '담당자1', count: 2, ing: 1, done: 1 },
        { name: '담당자2', count: 1, ing: 1, done: 0 },
        { name: '담당자3', count: 0, ing: 0, done: 0 }
      ]
    },
    {
      id: 'sg2', num: 2, date: '2026-04-12', type: 'My Designs', target: 'HER2', title: 'Scaffold B optimization',
      share: '비공개', ing: 1, done: 2, unassigned: 0, total: 3,
      managers: [
        { name: '담당자4', count: 3, ing: 1, done: 2 }
      ]
    },
  ];

  // Mock Data for Compounds
  const compoundGroups = [
    {
      id: 'cg1', num: 1, date: '2026-04-15', type: 'My Compounds', target: 'cMET', title: 'Synthesized VRA-100s',
      share: '공유받음', ing: 5, done: 10, unassigned: 0, total: 15,
      managers: [
        { name: '담당자1', count: 8, ing: 3, done: 5 },
        { name: '담당자5', count: 7, ing: 2, done: 5 }
      ]
    },
    {
      id: 'cg2', num: 2, date: '2026-04-20', type: 'My Compounds', target: 'WRN', title: 'Lead Compound Batch 1',
      share: '비공개', ing: 2, done: 8, unassigned: 1, total: 11,
      managers: [
        { name: '담당자2', count: 4, ing: 1, done: 3 },
        { name: '담당자6', count: 3, ing: 1, done: 2 },
        { name: '담당자7', count: 3, ing: 0, done: 3 }
      ]
    },
  ];

  const currentGroups = useMemo(() => {
    let merged: any[] = [];
    if (selectedDataSources.includes('Designs')) merged = [...merged, ...designGroups];
    if (selectedDataSources.includes('Compounds')) merged = [...merged, ...compoundGroups];
    return merged;
  }, [selectedDataSources]);

  const mockSynthesisDetails: SynthesisDetail[] = [
    // Designs items
    { id: 'sd1', groupId: 'sg1', groupNum: 1, compoundId: 'VRA-001', name: 'VRA-001', smiles: 'CC1=CC=C(C=C1)S', assignee: '담당자1', requestDate: '2026-04-10', completeDate: null },
    { id: 'sd2', groupId: 'sg1', groupNum: 2, compoundId: 'VRA-002', name: 'VRA-002', smiles: 'CNC1=NC=NC=C1', assignee: '담당자2', requestDate: '2026-04-11', completeDate: null },
    { id: 'sd_new1', groupId: 'sg1', groupNum: 3, compoundId: 'VRA-003', name: 'VRA-003 (미배정)', smiles: 'CC(=O)C1=CC=CC=C1', assignee: null, requestDate: '2026-04-12', completeDate: null },
    { id: 'sd3', groupId: 'sg2', groupNum: 1, compoundId: 'VRA-004', name: 'VRA-004', smiles: 'C1=CC=C(C=C1)N', assignee: '담당자1', requestDate: '2026-04-12', completeDate: '2026-04-20' },
    // Compounds items
    { id: 'sd4', groupId: 'cg1', groupNum: 1, compoundId: 'VRA-101', name: 'VRA-101', smiles: 'CC(=O)NC1=CC=CC=C1', assignee: '담당자1', requestDate: '2026-04-15', completeDate: null },
    { id: 'sd5', groupId: 'cg2', groupNum: 1, compoundId: 'VRA-102', name: 'VRA-102', smiles: 'CC(C)C1=CC=CC=C1', assignee: '담당자2', requestDate: '2026-04-16', completeDate: '2026-04-21' },
    { id: 'sd_new2', groupId: 'cg2', groupNum: 2, compoundId: 'VRA-103', name: 'VRA-103 (미배정)', smiles: 'C1=CC=CC=C1O', assignee: null, requestDate: '2026-04-22', completeDate: null },
  ];

  const filteredDetails = useMemo(() => {
    return mockSynthesisDetails.filter(d =>
      d.groupId === selectedGroupId &&
      (d.name.toLowerCase().includes(keyword.toLowerCase()) || d.compoundId.toLowerCase().includes(keyword.toLowerCase()))
    );
  }, [selectedGroupId, keyword]);

  const groupColumns = [
    { title: 'Num', dataIndex: 'num', key: 'num', width: 50, align: 'center' as const },
    { title: 'Date', dataIndex: 'date', key: 'date', width: 90, render: (date: string) => <Text style={{ fontSize: 11 }}>{date}</Text> },
    { title: 'Type', dataIndex: 'type', key: 'type', width: 80, render: (type: string) => <Tag style={{ fontSize: 11, borderRadius: 4 }}>{type}</Tag> },
    { title: 'Target', dataIndex: 'target', key: 'target', width: 80, render: (text: string) => <Tag color="blue" style={{ fontSize: 11 }}>{text}</Tag> },
    { title: 'Title', dataIndex: 'title', key: 'title', ellipsis: true, render: (text: string) => <Text strong style={{ fontSize: 12 }}>{text}</Text> },
    { title: '공유', dataIndex: 'share', key: 'share', width: 70, render: (text: string) => <Text type="secondary" style={{ fontSize: 11 }}>{text}</Text> },
    {
      title: '합성중',
      dataIndex: 'ing',
      key: 'ing',
      width: 60,
      align: 'center' as const,
      render: (val: number, record: any) => (
        <Popover content={<ManagerComparisonPopup record={record} />} title={null} trigger="hover" placement="top">
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'help' }}>
            <Tag color="blue" style={{ borderRadius: 10, margin: 0 }}>{val}</Tag>
          </div>
        </Popover>
      )
    },
    {
      title: '합성완료',
      dataIndex: 'done',
      key: 'done',
      width: 70,
      align: 'center' as const,
      render: (val: number, record: any) => (
        <Popover content={<ManagerComparisonPopup record={record} />} title={null} trigger="hover" placement="top">
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'help' }}>
            <Tag color="success" style={{ borderRadius: 10, margin: 0 }}>{val}</Tag>
          </div>
        </Popover>
      )
    },
    {
      title: '미배정',
      dataIndex: 'unassigned',
      key: 'unassigned',
      width: 60,
      align: 'center' as const,
      render: (val: number, record: any) => (
        <Popover content={<ManagerComparisonPopup record={record} />} title={null} trigger="hover" placement="top">
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'help' }}>
            <Tag color={val > 0 ? 'error' : 'default'} style={{ borderRadius: 10, margin: 0 }}>{val}</Tag>
          </div>
        </Popover>
      )
    },
    {
      title: '총개수',
      dataIndex: 'total',
      key: 'total',
      width: 60,
      align: 'center' as const,
      render: (val: number, record: any) => (
        <Popover content={<ManagerComparisonPopup record={record} />} title={null} trigger="hover" placement="top">
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'help' }}>
            <Text strong style={{ fontSize: 11 }}>{val}</Text>
          </div>
        </Popover>
      )
    },
    ...Array.from({ length: 6 }).map((_, i) => ({
      title: `담당자${i + 1}`,
      key: `manager${i + 1}`,
      width: 80,
      align: 'center' as const,
      render: (record: any) => {
        const mgrName = `담당자${i + 1}`;
        const mgr = record.managers?.find((m: any) => m.name === mgrName) || { name: mgrName, count: 0 };

        return (
          <Popover content={<ManagerComparisonPopup record={record} currentMgrName={mgr.name} />} title={null} trigger="hover" placement="top">
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'help' }}>
              <Text style={{ fontSize: 12, fontWeight: 500, color: mgr.count > 0 ? token.colorText : token.colorTextTertiary }}>
                {mgr.count}
              </Text>
            </div>
          </Popover>
        );
      }
    }))
  ];

  const detailColumns = [
    { title: 'Num', key: 'num', width: 50, align: 'center' as const, render: (_: any, __: any, index: number) => index + 1 },
    { title: 'Grp.', dataIndex: 'groupNum', key: 'grp', width: 60, align: 'center' as const, render: (num: number) => <Text strong style={{ color: token.colorPrimary }}>{num}</Text> },
    { title: 'Compound', dataIndex: 'compoundId', key: 'compound', width: 100 },
    {
      title: 'Structure',
      dataIndex: 'smiles',
      key: 'structure',
      width: 100,
      align: 'center' as const,
      render: () => (
        <div style={{ width: 80, height: 50, background: token.colorBgLayout, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${token.colorBorderSecondary}` }}>
          <FlaskConical size={18} color={token.colorBorder} />
        </div>
      )
    },
    { title: 'Name', dataIndex: 'name', key: 'name', ellipsis: true },
    {
      title: '합성 담당자',
      dataIndex: 'assignee',
      key: 'assignee',
      width: 130,
      render: (assignee: string | null, record: SynthesisDetail) => (
        assignee ? (
          <div
            style={{
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              background: token.colorBgContainer,
              border: `1px solid ${token.colorBorderSecondary}`,
              borderRadius: 6,
              transition: 'all 0.2s',
            }}
            className="assignee-button"
            onClick={() => { setSelectedItem(record); setIsAssignModalOpen(true); }}
          >
            <UserPlus size={14} color={token.colorPrimary} />
            <Text style={{ fontSize: 12, fontWeight: 500, color: token.colorText }}>{assignee}</Text>
          </div>
        ) : (
          <Button
            size="small"
            icon={<UserPlus size={14} />}
            onClick={() => { setSelectedItem(record); setIsAssignModalOpen(true); }}
            style={{ borderRadius: 6, fontSize: 11 }}
          >
            배정
          </Button>
        )
      )
    },
    { title: '합성 요청 일자', dataIndex: 'requestDate', key: 'requestDate', width: 120, render: (date: string) => <Text style={{ fontSize: 12 }}>{date}</Text> },
    { title: '합성 완료 일자', dataIndex: 'completeDate', key: 'completeDate', width: 120, render: (date: string | null) => <Text style={{ fontSize: 12 }}>{date || '-'}</Text> }
  ];

  return (
    <div className="gx-main-content">
      {/* Top Search Header - Removed Source Toggle from here */}
      <Card variant="borderless" className="c-card" style={{ marginBottom: 20, borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
        <Row gutter={[16, 16]} align="middle">
          <Col flex="auto">
            <Space size="middle">
              <Input
                prefix={<Search size={18} color={token.colorTextTertiary} />}
                placeholder="그룹 또는 화합물 ID 검색"
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
            </Space>
          </Col>
          <Col>
            <Space>
              <Button type="primary" icon={<Plus size={18} />} style={{ height: 44, borderRadius: 12, background: token.colorPrimary, borderColor: token.colorPrimary }}>New Group</Button>
              <Button icon={<Settings size={18} />} style={{ height: 44, borderRadius: 12 }}>설정</Button>
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
                    <Segmented
                      options={['3개월', '6개월', '12개월', '전체']}
                      value={period}
                      onChange={(v) => setPeriod(v as string)}
                    />
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

      <Row gutter={[20, 20]}>
        {/* Left: Group List (Single Select) - Increased width for many columns */}
        <Col span={14}>
          <div className="c-card" style={{ background: token.colorBgContainer, borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '16px 24px', borderBottom: `1px solid ${token.colorBorderSecondary}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text strong style={{ color: token.colorPrimary }}>합성 그룹 리스트</Text>
              <div style={{ background: token.colorBgLayout, padding: '2px 8px', borderRadius: 8, display: 'flex', gap: 12 }}>
                <Checkbox
                  checked={selectedDataSources.includes('Designs')}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...selectedDataSources, 'Designs']
                      : selectedDataSources.filter(s => s !== 'Designs');
                    if (next.length > 0) setSelectedDataSources(next);
                  }}
                >
                  <Text style={{ fontSize: 11 }}>My Designs</Text>
                </Checkbox>
                <Checkbox
                  checked={selectedDataSources.includes('Compounds')}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...selectedDataSources, 'Compounds']
                      : selectedDataSources.filter(s => s !== 'Compounds');
                    if (next.length > 0) setSelectedDataSources(next);
                  }}
                >
                  <Text style={{ fontSize: 11 }}>My Compounds</Text>
                </Checkbox>
              </div>
            </div>
            <Table
              dataSource={currentGroups}
              columns={groupColumns}
              pagination={false}
              size="small"
              rowKey="id"
              scroll={{ x: 1200, y: 'calc(100vh - 350px)' }}
              onRow={(record) => ({
                onClick: () => setSelectedGroupId(record.id),
                style: { cursor: 'pointer' }
              })}
              rowClassName={(record) => selectedGroupId === record.id ? 'row-selected' : ''}
            />
          </div>
        </Col>

        {/* Right: Synthesis Details */}
        <Col span={10}>
          <div className="c-card" style={{ background: token.colorBgContainer, borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '16px 24px', borderBottom: `1px solid ${token.colorBorderSecondary}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text strong style={{ color: token.colorPrimary }}>합성 상세 목록</Text>
              <div style={{ background: token.colorBgLayout, padding: '2px', borderRadius: 6, display: 'flex' }}>
                <Button 
                  type="text" 
                  size="small" 
                  icon={<ListIcon size={14} />} 
                  style={{ 
                    background: viewMode === 'table' ? token.colorBgContainer : 'transparent',
                    boxShadow: viewMode === 'table' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                    borderRadius: 4,
                    fontSize: 11
                  }}
                  onClick={() => setViewMode('table')}
                >
                  Table
                </Button>
                <Button 
                  type="text" 
                  size="small" 
                  icon={<ImageIcon size={14} />} 
                  style={{ 
                    background: viewMode === 'draw' ? token.colorBgContainer : 'transparent',
                    boxShadow: viewMode === 'draw' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                    borderRadius: 4,
                    fontSize: 11
                  }}
                  onClick={() => setViewMode('draw')}
                >
                  Canvas
                </Button>
                <Button 
                  type="text" 
                  size="small" 
                  icon={<GitBranch size={14} />} 
                  style={{ 
                    background: viewMode === 'tree' ? token.colorBgContainer : 'transparent',
                    boxShadow: viewMode === 'tree' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                    borderRadius: 4,
                    fontSize: 11
                  }}
                  onClick={() => setViewMode('tree')}
                >
                  Tree
                </Button>
              </div>
            </div>
            {viewMode === 'table' ? (
              <Table
                dataSource={filteredDetails}
                columns={detailColumns}
                size="small"
                pagination={{ pageSize: 20 }}
                rowKey="id"
                scroll={{ y: 'calc(100vh - 350px)' }}
              />
            ) : viewMode === 'draw' ? (
              <div style={{ padding: 20, overflowY: 'auto', height: 'calc(100vh - 350px)' }}>
                <Row gutter={[12, 12]}>
                  {filteredDetails.map(d => (
                    <Col span={12} key={d.id}>
                      <div style={{ 
                        border: `1px solid ${token.colorBorderSecondary}`, 
                        borderRadius: 8, 
                        overflow: 'hidden',
                        transition: 'all 0.3s ease',
                        cursor: 'pointer'
                      }}
                      className="canvas-card"
                      onClick={() => { setSelectedItem(d); setIsAssignModalOpen(true); }}
                      >
                        <div style={{ padding: '6px 10px', background: token.colorBgLayout, borderBottom: `1px solid ${token.colorBorderSecondary}`, display: 'flex', justifyContent: 'space-between' }}>
                          <Text strong style={{ color: token.colorPrimary, fontSize: 11 }}>{d.compoundId}</Text>
                          {d.assignee && <Tag color="orange" style={{ fontSize: 10, margin: 0, padding: '0 4px' }}>{d.assignee}</Tag>}
                        </div>
                        <div style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', background: token.colorBgContainer }}>
                          <FlaskConical size={24} color={token.colorBorder} />
                        </div>
                      </div>
                    </Col>
                  ))}
                </Row>
              </div>
            ) : (
              <div style={{ padding: 40, textAlign: 'center', color: token.colorTextTertiary }}>Tree View 준비 중...</div>
            )}
          </div>
        </Col>
      </Row>

      {/* Assign Manager Modal */}
      <Modal
        title="합성 요청"
        open={isAssignModalOpen}
        onCancel={() => setIsAssignModalOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setIsAssignModalOpen(false)}>닫기</Button>,
          selectedItem?.assignee && (
            <Button 
              key="remove" 
              danger 
              onClick={() => {
                // TODO: 담당자 취소 로직 (API 연동 필요)
                setIsAssignModalOpen(false);
              }}
            >
              담당자 취소
            </Button>
          ),
          <Button key="ok" type="primary" onClick={() => setIsAssignModalOpen(false)} style={{ background: token.colorPrimary, borderColor: token.colorPrimary }}>
            {selectedItem?.assignee ? '담당자 수정' : '배정 완료'}
          </Button>
        ]}
        width={450}
      >
        <div style={{ padding: '10px 0' }}>
          <div style={{ marginBottom: 20, padding: 16, background: isDarkMode ? '#2a1f1d' : '#fdf2f0', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 60, height: 40, background: token.colorBgContainer, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${token.colorBorderSecondary}` }}>
              <FlaskConical size={20} color={token.colorPrimary} />
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>Selected Compound</Text><br />
              <Text strong>{selectedItem?.compoundId} ({selectedItem?.name})</Text>
            </div>
          </div>
          <Text strong>연구원 선택</Text>
          <Select
            showSearch
            placeholder="이름으로 검색하여 연구원 선택"
            style={{ width: '100%', marginTop: 8 }}
            options={[
              { value: 'r1', label: '담당자1' },
              { value: 'r2', label: '담당자2' },
              { value: 'r3', label: '담당자3' },
            ]}
          />
        </div>
      </Modal>

      <style>{`
        .row-selected {
          background-color: ${isDarkMode ? '#2a1f1d' : '#fff7f6'} !important;
        }
        .row-selected td {
          background-color: ${isDarkMode ? '#2a1f1d' : '#fff7f6'} !important;
        }
        .ant-table-thead > tr > th {
          background: ${isDarkMode ? '#1f1f1f' : '#fafafa'} !important;
          color: ${isDarkMode ? 'rgba(255,255,255,0.85)' : '#495057'} !important;
          font-size: 12px;
          font-weight: 600;
        }
        .ant-table-tbody > tr > td {
          font-size: 12px;
        }
        .c-card {
          border: 1px solid ${isDarkMode ? '#303030' : '#f0f0f0'} !important;
        }
        .canvas-card:hover {
          border-color: #F87C63 !important;
          box-shadow: 0 4px 12px rgba(248, 124, 99, 0.1);
          transform: translateY(-2px);
        }
      `}</style>
    </div>
  );
};

export default SynthesisBoard;
