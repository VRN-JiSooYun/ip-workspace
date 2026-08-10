import React, { useEffect } from 'react';
import { Row, Col, Typography, Button } from 'antd';
import { FileText, Settings } from 'lucide-react';
import { useUIStore } from '../store/useUIStore';
import { getPatentAnalysisLayoutPreset } from '../config/patentAnalysisLayout';
import PageHeaderBreadcrumb from '../components/common/PageHeaderBreadcrumb';
import { formatDisplayDate } from '../utils/displayFormat';

const { Title } = Typography;

/**
 * Placeholder shell for the IP dashboard.
 *
 * The chemistry cards (Compounds, PDBs, Calculations, ELN, server monitoring,
 * cafeteria, lab news) were removed along with those modules. What remains is
 * the Documents card, still showing hardcoded sample rows — a real IP dashboard
 * wired to patent data is a separate design task.
 */
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
        boxSizing: 'border-box',
        display: 'block'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0, color: 'var(--brand-primary)', fontWeight: 600 }}>
          {formatDisplayDate('2025.04.14')} ~ {formatDisplayDate('2025.04.21')}
        </Title>
        <Button
          type="primary"
          size="large"
          className="v-action-btn"
          style={{
            padding: '0 24px',
            background: 'var(--brand-primary)',
            border: 'none',
            fontWeight: 700,
            fontSize: '15px',
            boxShadow: '0 2px 6px rgba(var(--brand-primary-rgb), 0.2)'
          }}
        >
          What's New
        </Button>
      </div>

      <Row gutter={[20, 20]}>
        <Col xs={24} sm={12} lg={6}>
          <div className="dashboard-card" style={{ minHeight: 320 }}>
            <div className="dashboard-card-icon" style={{ borderColor: 'var(--brand-primary)', color: 'var(--brand-primary)' }}><FileText size={20} /></div>
            <div className="dashboard-card-title" style={{ color: 'var(--brand-primary)', borderColor: '#f0f0f0' }}>Documents</div>
            <div className="dashboard-card-content">
              <div className="dashboard-list-title" style={{ color: 'var(--brand-primary)' }}>Patent <Settings size={14} style={{ marginLeft: 8, cursor: 'pointer' }} /></div>
              <div className="dashboard-list-item">FGFR 특허 WO203918503</div>
              <div className="dashboard-list-item">cMET 특허 WO203134456</div>
              <div className="dashboard-list-title" style={{ marginTop: 12, color: 'var(--brand-primary)' }}>Paper</div>
              <div className="dashboard-list-item">FGFR / cMET 윈 논문</div>
            </div>
          </div>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
