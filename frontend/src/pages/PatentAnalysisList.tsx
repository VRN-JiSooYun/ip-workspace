import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Table, 
  Button, 
  Input, 
  Space, 
  Tag, 
  Card, 
  Typography, 
  Row, 
  Col, 
  theme,
  Checkbox,
  Segmented,
  DatePicker
} from 'antd';
import { 
  Search, 
  Plus, 
  Star, 
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Beaker
} from 'lucide-react';
import { Patent, mockPatents } from '../mocks/patents';
import ChemDrawModal from '../components/common/ChemDrawModal';
import { useUIStore } from '../store/useUIStore';
import PageHeaderBreadcrumb from '../components/common/PageHeaderBreadcrumb';

const { Text } = Typography;

const PatentAnalysisList: React.FC = () => {
  const { token } = theme.useToken();
  const navigate = useNavigate();
  
  const [isChemDrawVisible, setIsChemDrawVisible] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedProject, setSelectedProject] = useState('EGFR');
  const [period, setPeriod] = useState('전체');
  const { setHeaderContent } = useUIStore();

  useEffect(() => {
    setHeaderContent(
      <PageHeaderBreadcrumb 
        items={[
          { label: 'Documents' },
          { label: 'Patents' },
          { label: 'My 특허 분석' }
        ]} 
      />
    );
    return () => setHeaderContent(null);
  }, [setHeaderContent]);

  const columns = [
    {
      title: '',
      dataIndex: 'isFavorite',
      key: 'favorite',
      width: 50,
      render: (fav: boolean) => (
        <Star size={18} fill={fav ? "#F87C63" : "none"} color={fav ? "#F87C63" : token.colorTextDescription} />
      ),
    },
    {
      title: '특허 번호',
      dataIndex: 'patentNumber',
      key: 'patentNumber',
      width: 180,
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: '제목',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: '출원인',
      dataIndex: 'applicant',
      key: 'applicant',
      width: 150,
    },
    {
      title: '출판일',
      dataIndex: 'publicationDate',
      key: 'publicationDate',
      width: 120,
    },
    {
      title: '타겟',
      dataIndex: 'target',
      key: 'target',
      width: 100,
      render: (text: string) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: '상태',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string) => {
        let color = 'default';
        if (status === 'Completed') color = 'success';
        if (status === 'Analyzing') color = 'processing';
        return <Tag color={color}>{status}</Tag>;
      },
    },
    {
      title: '작업',
      key: 'action',
      width: 80,
      render: (_: any, record: Patent) => (
        <Button 
          type="text" 
          icon={<ExternalLink size={16} />} 
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/patents/analysis/${record.id}`);
          }} 
        />
      ),
    },
  ];

  return (
    <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '0 24px', height: '100%', width: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'fadeIn 0.3s ease-out' }}>
        <Card variant="borderless" style={{ marginBottom: 16, borderRadius: 12, flexShrink: 0 }}>
          <Row gutter={[16, 16]} align="middle">
            <Col flex="auto">
              <Space size="middle">
                <Input
                  prefix={<Search size={18} color={token.colorTextTertiary} />}
                  placeholder="특허 제목, 번호, 초록 검색..."
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                  style={{ width: 350, height: 44, borderRadius: 12 }}
                />
                <Button
                  icon={showFilters ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  onClick={() => setShowFilters(!showFilters)}
                  style={{ height: 44, borderRadius: 12 }}
                >
                  상세 필터 {showFilters ? '닫기' : '열기'}
                </Button>
                <Button
                  icon={<Beaker size={18} />}
                  onClick={() => setIsChemDrawVisible(true)}
                  style={{ height: 44, borderRadius: 12 }}
                >
                  구조 검색
                </Button>
              </Space>
            </Col>
            <Col>
              <Button 
                type="primary" 
                icon={<Plus size={18} />} 
                style={{ height: 44, borderRadius: 12, background: '#F87C63', borderColor: '#F87C63' }}
              >
                신규 특허 등록
              </Button>
            </Col>
          </Row>
          {showFilters && (
            <div style={{ marginTop: 24, padding: 20, background: token.colorBgLayout, borderRadius: 12 }}>
              <Row gutter={[32, 24]}>
                <Col span={8}>
                  <Text strong>특허청</Text><br />
                  <div style={{ marginTop: 12 }}>
                    <Checkbox.Group 
                      options={['ALL', 'WIPO', 'USPTO', 'KIPO', 'EPO']} 
                      defaultValue={['ALL', 'WIPO', 'USPTO']} 
                    />
                  </div>
                </Col>
                <Col span={8}>
                  <Text strong>분석 상태</Text><br />
                  <div style={{ marginTop: 12 }}>
                    <Checkbox.Group 
                      options={['ALL', '분석중', '완료']} 
                      defaultValue={['ALL']} 
                    />
                  </div>
                </Col>
                <Col span={24}>
                  <Text strong>Recent Projects</Text><br />
                  <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {['EGFR', 'AKT1', 'MET', 'FGFR3', 'VRK1', 'PKMYT1', 'WEE1', 'UBP1'].map(project => (
                      <Tag.CheckableTag 
                        key={project}
                        checked={selectedProject === project}
                        onChange={(checked) => checked && setSelectedProject(project)}
                        style={{ 
                          padding: '4px 12px', 
                          fontSize: '14px',
                          border: `1px solid ${selectedProject === project ? token.colorPrimary : token.colorBorder}`,
                          borderRadius: '6px'
                        }}
                      >
                        {project}
                      </Tag.CheckableTag>
                    ))}
                  </div>
                </Col>
                <Col span={24}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <Text strong>기간</Text>
                    <Segmented 
                      options={['3개월', '6개월', '12개월', '전체']} 
                      value={period} 
                      onChange={(v) => setPeriod(v as string)} 
                      style={{ borderRadius: '8px' }}
                    />
                    <DatePicker.RangePicker 
                      style={{ borderRadius: '8px' }} 
                      disabled={period !== '전체'}
                    />
                  </div>
                </Col>
              </Row>
            </div>
          )}
        </Card>

        <div style={{
          flex: 1,
          background: token.colorBgContainer,
          borderRadius: '20px',
          overflow: 'hidden',
          border: `1px solid ${token.colorBorderSecondary}`,
          display: 'flex',
          flexDirection: 'column'
        }}>
          <Table
            columns={columns}
            dataSource={mockPatents.filter(p => p.title.toLowerCase().includes(searchText.toLowerCase()) || p.patentNumber.includes(searchText))}
            rowKey="id"
            onRow={(record) => ({
              onClick: () => navigate(`/patents/analysis/${record.id}`),
              style: { cursor: 'pointer' }
            })}
            pagination={{ pageSize: 10, position: ['bottomCenter'], style: { margin: '16px 0' } }}
            scroll={{ y: 'calc(100vh - 420px)' }}
            style={{ flex: 1 }}
          />
        </div>

        <ChemDrawModal 
          open={isChemDrawVisible} 
          onCancel={() => setIsChemDrawVisible(false)} 
          onConfirm={(data) => {
            setSearchText(data.smiles);
            setIsChemDrawVisible(false);
          }}
          title="구조 검색"
          confirmText="이 구조로 검색"
        />
      </div>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .ant-table-thead > tr > th {
          background: transparent !important;
          border-bottom: 2px solid ${token.colorBorderSecondary} !important;
        }
        .ant-table-row:hover \u003e td {
          background: ${token.colorFillAlter} !important;
        }
        .cursor-pointer { cursor: pointer; }
      `}</style>
    </div>
  );
};

export default PatentAnalysisList;
