import React, { useEffect, useMemo } from 'react';
import { Typography, theme } from 'antd';
import { ExternalLink } from 'lucide-react';
import PageHeaderBreadcrumb from '../components/common/PageHeaderBreadcrumb';
import { useUIStore } from '../store/useUIStore';

const { Text } = Typography;

type RuntimeWindow = Window & {
  _env_?: {
    VITE_MONITORING_URL?: string;
  };
};

const getMonitoringUrl = () => {
  const runtimeValue = typeof window !== 'undefined'
    ? (window as RuntimeWindow)._env_?.VITE_MONITORING_URL
    : undefined;

  return runtimeValue || import.meta.env.VITE_MONITORING_URL || '/monitoring/';
};

const Monitoring: React.FC = () => {
  const { token } = theme.useToken();
  const { setHeaderContent } = useUIStore();
  const monitoringUrl = useMemo(() => getMonitoringUrl(), []);

  useEffect(() => {
    setHeaderContent(<PageHeaderBreadcrumb items={[{ label: '모니터링' }]} />);
    return () => setHeaderContent(null);
  }, [setHeaderContent]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        width: '100%',
        minHeight: 'calc(100vh - 112px)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          minHeight: 28,
        }}
      >
        <Text type="secondary">내부 모니터링 화면을 현재 워크스페이스에서 확인합니다.</Text>
        <a
          href={monitoringUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: token.colorPrimary, fontWeight: 600 }}
        >
          새 창으로 열기
          <ExternalLink size={14} />
        </a>
      </div>

      <div
        style={{
          flex: '1 1 auto',
          minHeight: 640,
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: 8,
          overflow: 'hidden',
          background: token.colorBgContainer,
        }}
      >
        <iframe
          title="모니터링"
          src={monitoringUrl}
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            minHeight: 640,
            border: 0,
            background: token.colorBgContainer,
          }}
        />
      </div>
    </div>
  );
};

export default Monitoring;
