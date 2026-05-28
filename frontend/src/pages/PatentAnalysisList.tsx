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
  Segmented,
  DatePicker
} from 'antd';
import { 
  Search, 
  Plus, 
  Star, 
  ChevronDown,
  ChevronUp,
  ExternalLink
} from 'lucide-react';
import BenzeneIcon from '../components/common/BenzeneIcon';
import { Patent, mockPatents } from '../mocks/patents';
import ChemDrawModal from '../components/common/ChemDrawModal';
import { getPatentAnalysisLayoutPreset } from '../config/patentAnalysisLayout';
import { useUIStore } from '../store/useUIStore';
import PageHeaderBreadcrumb from '../components/common/PageHeaderBreadcrumb';
import ToggleTag from '../components/common/ToggleTag';
import { mapPatentListItem, patentAnalysisApi } from '../services/patentAnalysisApi';

const { Text } = Typography;

const PATENT_LIST_TITLE_COLUMN_WIDTH = 480;
const PATENT_LIST_TABLE_SCROLL_X = 1370;

const PatentAnalysisList: React.FC = () => {
  const { token } = theme.useToken();
  const navigate = useNavigate();
  
  const [isChemDrawVisible, setIsChemDrawVisible] = useState(false);
  const [patents, setPatents] = useState<Patent[]>(mockPatents);
  const [isLoadingPatents, setIsLoadingPatents] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedProject, setSelectedProject] = useState('EGFR');
  const [selectedOffices, setSelectedOffices] = useState(['ALL', 'WIPO', 'USPTO']);
  const [selectedStatuses, setSelectedStatuses] = useState(['ALL']);
  const [period, setPeriod] = useState('전체');
  const [viewportWidth, setViewportWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return 1920;
    return window.innerWidth;
  });
  const [viewportHeight, setViewportHeight] = useState<number>(() => {
    if (typeof window === 'undefined') return 1080;
    return window.innerHeight;
  });
  const { setHeaderContent } = useUIStore();
  const layoutPreset = React.useMemo(() => getPatentAnalysisLayoutPreset(viewportWidth), [viewportWidth]);
  const isResponsiveToolbar = viewportWidth <= 1100;

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

  useEffect(() => {
    const onResize = () => {
      setViewportWidth(window.innerWidth);
      setViewportHeight(window.innerHeight);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    let ignore = false;

    const loadPatents = async () => {
      setIsLoadingPatents(true);
      try {
        const response = await patentAnalysisApi.getMyPatents({ page: 1, pageSize: 50 });
        if (ignore) return;
        const mappedPatents = response.items.map(mapPatentListItem);
        setPatents(mappedPatents.length > 0 ? mappedPatents : mockPatents);
      } catch (error) {
        if (!ignore) {
          setPatents(mockPatents);
        }
      } finally {
        if (!ignore) {
          setIsLoadingPatents(false);
        }
      }
    };

    void loadPatents();

    return () => {
      ignore = true;
    };
  }, []);

  const filteredPatents = React.useMemo(() => {
    const normalizedSearchText = searchText.trim().toLowerCase();
    if (!normalizedSearchText) {
      return patents;
    }
    return patents.filter((patent) =>
      patent.title.toLowerCase().includes(normalizedSearchText) ||
      patent.patentNumber.toLowerCase().includes(normalizedSearchText)
    );
  }, [patents, searchText]);

  const patentListTableScrollY = React.useMemo(() => {
    return Math.max(280, viewportHeight - 420);
  }, [viewportHeight]);

  const patentListTableScroll = React.useMemo(() => {
    const estimatedRowHeight = 64;
    const needsVerticalScroll = filteredPatents.length * estimatedRowHeight > patentListTableScrollY;
    return needsVerticalScroll
      ? { x: PATENT_LIST_TABLE_SCROLL_X, y: patentListTableScrollY }
      : { x: PATENT_LIST_TABLE_SCROLL_X };
  }, [filteredPatents.length, patentListTableScrollY]);

  const columns = [
    {
      title: '',
      dataIndex: 'isFavorite',
      key: 'favorite',
      width: 50,
      align: 'center' as const,
      className: 'table-center-column',
      render: (fav: boolean) => (
        <Star size={18} fill={fav ? "#F87C63" : "none"} color={fav ? "#F87C63" : token.colorTextDescription} />
      ),
    },
    {
      title: '특허 번호',
      dataIndex: 'patentNumber',
      key: 'patentNumber',
      width: 270,
      align: 'center' as const,
      className: 'table-center-column',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: '제목',
      dataIndex: 'title',
      key: 'title',
      width: PATENT_LIST_TITLE_COLUMN_WIDTH,
      className: 'responsive-text-column',
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
      align: 'center' as const,
      className: 'table-center-column',
    },
    {
      title: '타겟',
      dataIndex: 'target',
      key: 'target',
      width: 100,
      align: 'center' as const,
      className: 'table-center-column',
      render: (text: string) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: '상태',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      align: 'center' as const,
      className: 'table-center-column',
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
      align: 'center' as const,
      className: 'table-center-column',
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
    <div style={{ maxWidth: layoutPreset.maxWidth, margin: '0 auto', padding: `0 ${layoutPreset.sidePadding}px`, height: '100%', width: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'fadeIn 0.3s ease-out' }}>
        <Card variant="borderless" className="c-card compact-filter-card" style={{ marginBottom: 12, flexShrink: 0 }}>
          <Row gutter={[12, 8]} align="middle">
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
                <Input
                  prefix={<Search size={18} color={token.colorTextTertiary} />}
                  placeholder="특허 제목, 번호, 초록 검색..."
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                  className="v-search-input"
                  style={{
                    flex: '1 1 260px',
                    minWidth: 180,
                    maxWidth: isResponsiveToolbar ? '100%' : 350,
                  }}
                />
                <Button
                  icon={showFilters ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  onClick={() => setShowFilters(!showFilters)}
                  className="v-action-btn"
                >
                  상세 필터 {showFilters ? '닫기' : '열기'}
                </Button>
                <Button
                  icon={<BenzeneIcon size={18} />}
                  onClick={() => setIsChemDrawVisible(true)}
                  className="v-action-btn"
                >
                  구조 검색
                </Button>
              </div>
            </Col>
            <Col flex={isResponsiveToolbar ? '1 1 100%' : 'none'}>
              <Button 
                type="primary" 
                icon={<Plus size={18} />} 
                className="v-action-btn"
                style={{
                  background: '#F87C63',
                  borderColor: '#F87C63',
                  width: isResponsiveToolbar ? '100%' : undefined,
                }}
              >
                신규 특허 등록
              </Button>
            </Col>
          </Row>
          {showFilters && (
            <div className="compact-filter-panel">
              <Row gutter={[24, 12]}>
                <Col span={6}>
                  <Text strong>특허청</Text><br />
                  <div style={{ marginTop: 4 }}>
                    <Space wrap>
                      {['ALL', 'WIPO', 'USPTO', 'KIPO', 'EPO'].map(opt => (
                        <ToggleTag
                          key={opt}
                          checked={selectedOffices.includes(opt)}
                          onChange={(checked) => {
                            setSelectedOffices((prev) => (
                              checked ? [...prev, opt] : prev.filter(item => item !== opt)
                            ));
                          }}
                        >
                          {opt}
                        </ToggleTag>
                      ))}
                    </Space>
                  </div>
                </Col>
                <Col span={6}>
                  <Text strong>분석 상태</Text><br />
                  <div style={{ marginTop: 4 }}>
                    <Space wrap>
                      {['ALL', '분석중', '완료'].map(opt => (
                        <ToggleTag
                          key={opt}
                          checked={selectedStatuses.includes(opt)}
                          onChange={(checked) => {
                            setSelectedStatuses((prev) => (
                              checked ? [...prev, opt] : prev.filter(item => item !== opt)
                            ));
                          }}
                        >
                          {opt}
                        </ToggleTag>
                      ))}
                    </Space>
                  </div>
                </Col>
                <Col span={12}>
                  <Text strong>Recent Projects</Text><br />
                  <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {['EGFR', 'AKT1', 'MET', 'FGFR3', 'VRK1', 'PKMYT1', 'WEE1', 'UBP1'].map(project => (
                      <Tag.CheckableTag 
                        key={project}
                        checked={selectedProject === project}
                        onChange={(checked) => checked && setSelectedProject(project)}
                        className="v-project-tag"
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
                    />
                    <DatePicker.RangePicker 
                      disabled={period !== '전체'}
                    />
                  </div>
                </Col>
              </Row>
            </div>
          )}
        </Card>

        <div className="v-table-card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <Table
            columns={columns}
            dataSource={filteredPatents}
            rowKey="id"
            loading={isLoadingPatents}
            onRow={(record) => ({
              onClick: () => navigate(`/patents/analysis/${record.id}`),
              style: { cursor: 'pointer' }
            })}
            pagination={{ pageSize: 10, position: ['bottomCenter'], style: { margin: '16px 0' } }}
            scroll={patentListTableScroll}
            style={{ flex: 1 }}
            tableLayout="fixed"
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
          background: var(--table-header-bg) !important;
          border-bottom: 1px solid ${token.colorBorderSecondary} !important;
        }
        .ant-table-row:hover > td {
          background: var(--table-row-hover-bg) !important;
        }
        .cursor-pointer { cursor: pointer; }
      `}</style>
    </div>
  );
};

export default PatentAnalysisList;
