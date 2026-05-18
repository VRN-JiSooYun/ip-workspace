import React, { useEffect } from 'react';
import { Row, Col, Typography, Button, Space } from 'antd';
import { 
  Beaker, 
  FileText, 
  Activity, 
  Calculator, 
  Book, 
  Settings, 
  Coffee, 
  Volume2 
} from 'lucide-react';
import { useUIStore } from '../store/useUIStore';
import { getPatentAnalysisLayoutPreset } from '../config/patentAnalysisLayout';
import PageHeaderBreadcrumb from '../components/common/PageHeaderBreadcrumb';
import BenzeneIcon from '../components/common/BenzeneIcon';

const { Title, Text } = Typography;

const Dashboard: React.FC = () => {
  const { setHeaderContent } = useUIStore();
  const [viewportWidth, setViewportWidth] = React.useState<number>(() => {
    if (typeof window === 'undefined') return 1920;
    return window.innerWidth;
  });
  const layoutPreset = React.useMemo(() => getPatentAnalysisLayoutPreset(viewportWidth), [viewportWidth]);

  useEffect(() => {
    setHeaderContent(<PageHeaderBreadcrumb items={[{ label: 'Dashboard' }]} />);
    return () => setHeaderContent(null);
  }, [setHeaderContent]);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <div
      className="dashboard-container"
      style={{
        maxWidth: layoutPreset.maxWidth,
        margin: '0 auto',
        padding: `0 ${layoutPreset.sidePadding}px`,
        height: 'auto',
        width: '100%',
        display: 'block'
      }}
    >
      {/* Top Header Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0, color: '#F87C63', fontWeight: 600 }}>
          2025.04.14. ~ 2025.04.21.
        </Title>
        <Button 
          type="primary" 
          size="large"
          className="v-action-btn"
          style={{ 
            padding: '0 24px', 
            background: '#F87C63', 
            border: 'none',
            fontWeight: 700,
            fontSize: '16px',
            boxShadow: '0 2px 6px rgba(248, 124, 99, 0.2)'
          }}
        >
          What's New
        </Button>
      </div>

      {/* Responsive Grid Sections */}
      <Row gutter={[20, 20]}>
        {/* Top Priority Cards (Synthesis, Documents, PDBs, Calculations) */}
        <Col xs={24} sm={12} lg={6}>
          <div className="dashboard-card" style={{ minHeight: 320 }}>
            <div className="dashboard-card-icon" style={{ borderColor: '#F87C63', color: '#F87C63' }}><BenzeneIcon size={20} /></div>
            <div className="dashboard-card-title" style={{ color: '#F87C63', borderColor: '#f0f0f0' }}>Compounds</div>
            <div className="dashboard-card-content" style={{ fontSize: '13px' }}>
              <div className="dashboard-list-title" style={{ color: '#F87C63' }}>Synthesis</div>
              <div className="dashboard-list-item">박창인 chip_250418_comp8</div>
              <div className="dashboard-list-item">우씨 chip_250330_comp2</div>
              <div className="dashboard-list-title" style={{ marginTop: 12, color: '#F87C63' }}>Assay</div>
              <div className="dashboard-list-item">FGFR3 6LUB, 8WGI</div>
              <div className="dashboard-list-item">cMET 7MI7, 7U8C</div>
              <div className="dashboard-list-title" style={{ marginTop: 12, color: '#F87C63' }}>Profiling</div>
              <div className="dashboard-list-item">FGFR VRN235868</div>
            </div>
          </div>
        </Col>
        
        <Col xs={24} sm={12} lg={6}>
          <div className="dashboard-card" style={{ minHeight: 320 }}>
            <div className="dashboard-card-icon" style={{ borderColor: '#F87C63', color: '#F87C63' }}><FileText size={20} /></div>
            <div className="dashboard-card-title" style={{ color: '#F87C63', borderColor: '#f0f0f0' }}>Documents</div>
            <div className="dashboard-card-content">
              <div className="dashboard-list-title" style={{ color: '#F87C63' }}>Patent <Settings size={14} style={{ marginLeft: 8, cursor: 'pointer' }} /></div>
              <div className="dashboard-list-item">FGFR 특허 WO203918503</div>
              <div className="dashboard-list-item">cMET 특허 WO203134456</div>
              <div className="dashboard-list-title" style={{ marginTop: 12, color: '#F87C63' }}>Paper</div>
              <div className="dashboard-list-item">FGFR / cMET 윈 논문</div>
            </div>
          </div>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <div className="dashboard-card" style={{ minHeight: 320 }}>
            <div className="dashboard-card-icon" style={{ borderColor: '#F87C63', color: '#F87C63' }}><Activity size={20} /></div>
            <div className="dashboard-card-title" style={{ color: '#F87C63', borderColor: '#f0f0f0' }}>PDBs</div>
            <div className="dashboard-card-content">
              <div className="dashboard-list-title" style={{ color: '#F87C63' }}>in-house</div>
              <div className="dashboard-list-item">FGFR VNA213583</div>
              <div className="dashboard-list-item">cMET VNA213861</div>
              <div className="dashboard-list-title" style={{ marginTop: 12, color: '#F87C63' }}>RCSB</div>
              <div className="dashboard-list-item">FGFR3 6LUB, 8WGI</div>
              <div className="dashboard-list-item">Docking pose</div>
              <div className="dashboard-list-item">FGFR VRN235868</div>
            </div>
          </div>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <div className="dashboard-card" style={{ minHeight: 320 }}>
            <div className="dashboard-card-icon" style={{ borderColor: '#F87C63', color: '#F87C63' }}><Calculator size={20} /></div>
            <div className="dashboard-card-title" style={{ color: '#F87C63', borderColor: '#f0f0f0' }}>Calculations <Settings size={14} style={{ marginLeft: 8, cursor: 'pointer' }} /></div>
            <div className="dashboard-card-content">
              <Space direction="vertical" style={{ width: '100%' }} size={8}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <Text type="secondary">25.04.12.</Text><Text>3D PSA 12개 끝</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <Text type="secondary">25.04.19.</Text><Text>Permeability MD 5개 끝</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <Text type="secondary">25.04.20.</Text><Text>Permeability MD 14개 끝</Text>
                </div>
              </Space>
            </div>
          </div>
        </Col>

        {/* Secondary Info Cards (Smaller Height) */}
        <Col xs={24} sm={12} lg={6}>
          <div className="dashboard-card" style={{ minHeight: 200 }}>
            <div className="dashboard-card-icon"><Book size={18} /></div>
            <div className="dashboard-card-title">ELN</div>
            <div className="dashboard-card-content">
              <Text type="secondary" style={{ fontSize: '12px' }}>최근 작성된 노트가 없습니다.</Text>
            </div>
          </div>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <div className="dashboard-card" style={{ minHeight: 200 }}>
            <div className="dashboard-card-icon"><Settings size={18} /></div>
            <div className="dashboard-card-title">서버 모니터링</div>
            <div className="dashboard-card-content" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', fontSize: '11px' }}>
              <div>B200 <span className="status-badge status-warning">의심</span></div>
              <div>A400 <span className="status-badge status-normal">정식</span></div>
              <div>4090x3 02 <span className="status-badge status-normal">정상</span></div>
              <div>4090x3 03 <span className="status-badge status-normal">정상</span></div>
              <div>4090x6 03 <span className="status-badge status-danger">고장</span></div>
            </div>
          </div>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <div className="dashboard-card" style={{ minHeight: 200 }}>
            <div className="dashboard-card-icon"><Coffee size={18} /></div>
            <div className="dashboard-card-title">1층 식당 메뉴</div>
            <div className="dashboard-card-content">
              <div className="dashboard-list-title" style={{ marginTop: 0 }}>점심</div>
              <div style={{ fontSize: '13px' }}>닭 반질 튀김, 장조림, 샐러드</div>
            </div>
          </div>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <div className="dashboard-card" style={{ minHeight: 200 }}>
            <div className="dashboard-card-icon"><Volume2 size={18} /></div>
            <div className="dashboard-card-title">연구소 소식</div>
            <div className="dashboard-card-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <Text strong style={{ fontSize: '14px' }}>김도현 장가 가다 </Text>
                <Button type="link" size="small" style={{ color: '#3366cc', display: 'block', margin: '0 auto', fontSize: '12px' }}>[웹 화보]</Button>
              </div>
            </div>
          </div>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
