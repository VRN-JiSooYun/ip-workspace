import React, { useState, useMemo } from 'react';
import { 
  Row, Col, Card, Table, Button, Input, Checkbox, 
  Space, Typography, Modal, Form, Tag, Select, DatePicker, Avatar, Divider, Segmented, Popover
} from 'antd';
import { 
  Search, Plus, Filter, Settings, List as ListIcon, 
  FlaskConical, Info, ChevronDown, ChevronUp, Beaker, 
  UserPlus, CheckCircle2, Clock, AlertCircle, GripVertical, Users, Activity
} from 'lucide-react';
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

const ManagerComparisonPopup = ({ record, currentMgrName }: { record: any, currentMgrName?: string }) => (
  <div style={{ minWidth: 300 }}>
    <div style={{ marginBottom: 12, borderBottom: '1px solid #f0f0f0', paddingBottom: 8 }}>
      <Text strong style={{ fontSize: 13 }}>Group 담당자별 현황 비교</Text>
    </div>
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
          <th style={{ textAlign: 'left', padding: '4px 0', fontSize: 11, color: '#8c8c8c' }}>담당자</th>
          <th style={{ textAlign: 'center', padding: '4px 0', fontSize: 11, color: '#8c8c8c' }}>합성중</th>
          <th style={{ textAlign: 'center', padding: '4px 0', fontSize: 11, color: '#8c8c8c' }}>완료</th>
          <th style={{ textAlign: 'center', padding: '4px 0', fontSize: 11, color: '#8c8c8c' }}>합계</th>
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: 6 }).map((_, idx) => {
          const managerName = `담당자${idx + 1}`;
          const m = record.managers.find((mgrObj: any) => mgrObj.name === managerName) || 
                    { name: managerName, count: 0, ing: 0, done: 0 };
          
          return (
            <tr key={idx} style={{ background: m.name === currentMgrName ? '#fff7f6' : 'transparent' }}>
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

const SynthesisBoard: React.FC = () => {
  const [selectedDataSources, setSelectedDataSources] = useState<string[]>(['Designs']);
  const [showFilters, setShowFilters] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>('sg1');
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SynthesisDetail | null>(null);

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
    { id: 'sd3', groupId: 'sg2', groupNum: 1, compoundId: 'VRA-004', name: 'VRA-004', smiles: 'C1=CC=C(C=C1)N', assignee: '담당자1', requestDate: '2026-04-12', completeDate: '2026-04-20' },
    // Compounds items
    { id: 'sd4', groupId: 'cg1', groupNum: 1, compoundId: 'VRA-101', name: 'VRA-101', smiles: 'CC(=O)NC1=CC=CC=C1', assignee: '담당자1', requestDate: '2026-04-15', completeDate: null },
    { id: 'sd5', groupId: 'cg2', groupNum: 1, compoundId: 'VRA-102', name: 'VRA-102', smiles: 'CC(C)C1=CC=CC=C1', assignee: '담당자2', requestDate: '2026-04-16', completeDate: '2026-04-21' },
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
        const mgr = record.managers?.[i];
        if (!mgr) return null;
        
        return (
          <Popover content={<ManagerComparisonPopup record={record} currentMgrName={mgr.name} />} title={null} trigger="hover" placement="top">
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'help' }}>
              <Text style={{ fontSize: 12, fontWeight: 500 }}>{mgr.count}</Text>
            </div>
          </Popover>
        );
      }
    }))
  ];

  const detailColumns = [
    { title: 'Num', key: 'num', width: 50, align: 'center' as const, render: (_: any, __: any, index: number) => index + 1 },
    { title: 'Grp.', dataIndex: 'groupNum', key: 'grp', width: 60, align: 'center' as const, render: (num: number) => <Text strong style={{ color: '#F87C63' }}>{num}</Text> },
    { title: 'Compound', dataIndex: 'compoundId', key: 'compound', width: 100 },
    { 
      title: 'Structure', 
      dataIndex: 'smiles', 
      key: 'structure', 
      width: 100, 
      align: 'center' as const,
      render: () => (
        <div style={{ width: 80, height: 50, background: '#f8f9fa', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #eee' }}>
          <FlaskConical size={18} color="#dee2e6" />
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
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            onClick={() => { setSelectedItem(record); setIsAssignModalOpen(true); }}
          >
            <Text style={{ fontSize: 12 }}>{assignee}</Text>
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
                prefix={<Search size={18} color="#adb5bd" />} 
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
              <Button type="primary" icon={<Plus size={18} />} style={{ height: 44, borderRadius: 12, background: '#F87C63', borderColor: '#F87C63' }}>New Group</Button>
              <Button icon={<Settings size={18} />} style={{ height: 44, borderRadius: 12 }}>설정</Button>
            </Space>
          </Col>
        </Row>
        {showFilters && (
          <div style={{ marginTop: 24, padding: 20, background: '#f8f9fa', borderRadius: 12 }}>
            <Row gutter={[32, 24]}>
              <Col span={8}>
                <Text strong>Status</Text><br/>
                <Checkbox.Group options={['All', 'Pending', 'Synthesizing', 'Completed', 'On Hold']} defaultValue={['All']} />
              </Col>
              <Col span={8}>
                <Text strong>Priority</Text><br/>
                <Checkbox.Group options={['High', 'Medium', 'Low']} />
              </Col>
              <Col span={8}>
                <Text strong>Updated Period</Text><br/>
                <RangePicker style={{ width: '100%', borderRadius: 8 }} />
              </Col>
            </Row>
          </div>
        )}
      </Card>

      <Row gutter={[20, 20]}>
        {/* Left: Group List (Single Select) - Increased width for many columns */}
        <Col span={14}>
          <Card 
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <Space><ListIcon size={18} color="#F87C63" /><Text strong>Synthesis Groups</Text></Space>
                <div style={{ background: '#f8f9fa', padding: '2px 8px', borderRadius: 8, display: 'flex', gap: 12 }}>
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
            }
            variant="borderless"
            className="c-card"
            style={{ borderRadius: 12, height: 'calc(100vh - 200px)', overflow: 'hidden' }}
            styles={{ body: { padding: 0 } }}
          >
            <Table 
              dataSource={currentGroups} 
              columns={groupColumns} 
              pagination={false} 
              size="small"
              rowKey="id"
              scroll={{ x: 1200, y: 'calc(100vh - 300px)' }}
              onRow={(record) => ({
                onClick: () => setSelectedGroupId(record.id),
                style: { cursor: 'pointer' }
              })}
              rowClassName={(record) => selectedGroupId === record.id ? 'row-selected' : ''}
            />
          </Card>
        </Col>

        {/* Right: Synthesis Details */}
        <Col span={10}>
          <Card 
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <Space><Beaker size={18} color="#F87C63" /><Text strong>Synthesis Details</Text></Space>
                <Segmented options={['All', 'My Work', 'High Priority']} size="small" />
              </div>
            }
            variant="borderless"
            className="c-card"
            style={{ borderRadius: 12, height: 'calc(100vh - 200px)', overflow: 'hidden' }}
            styles={{ body: { padding: 0 } }}
          >
            <Table 
              dataSource={filteredDetails} 
              columns={detailColumns} 
              size="small"
              pagination={{ pageSize: 20 }}
              rowKey="id"
              scroll={{ y: 'calc(100vh - 350px)' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Assign Manager Modal */}
      <Modal
        title="Assign Synthesis Manager"
        open={isAssignModalOpen}
        onCancel={() => setIsAssignModalOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setIsAssignModalOpen(false)}>취소</Button>,
          <Button key="ok" type="primary" onClick={() => setIsAssignModalOpen(false)} style={{ background: '#F87C63', borderColor: '#F87C63' }}>배정 완료</Button>
        ]}
        width={450}
      >
        <div style={{ padding: '10px 0' }}>
          <div style={{ marginBottom: 20, padding: 16, background: '#fdf2f0', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 60, height: 40, background: '#fff', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #fee2e2' }}>
              <FlaskConical size={20} color="#F87C63" />
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>Selected Compound</Text><br/>
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
          background-color: #fff7f6 !important;
        }
        .row-selected td {
          background-color: #fff7f6 !important;
        }
        .ant-table-thead > tr > th {
          background: #fafafa !important;
          color: #495057 !important;
          font-size: 12px;
          font-weight: 600;
        }
        .ant-table-tbody > tr > td {
          font-size: 12px;
        }
        .c-card {
          border: 1px solid #f0f0f0 !important;
        }
      `}</style>
    </div>
  );
};

export default SynthesisBoard;
