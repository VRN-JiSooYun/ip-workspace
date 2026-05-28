import React, { useEffect } from 'react';
import { Empty } from 'antd';
import { theme } from 'antd';
import { useUIStore } from '../store/useUIStore';
import PageHeaderBreadcrumb from '../components/common/PageHeaderBreadcrumb';

interface EmptyPageProps {
  title?: string;
  breadcrumb?: { label: string }[];
}

const EmptyPage: React.FC<EmptyPageProps> = ({ title = 'Coming Soon', breadcrumb }) => {
  const { token } = theme.useToken();
  const { setHeaderContent } = useUIStore();

  useEffect(() => {
    if (breadcrumb) {
      setHeaderContent(<PageHeaderBreadcrumb items={breadcrumb} />);
    } else {
      setHeaderContent(<PageHeaderBreadcrumb items={[{ label: title }]} />);
    }
    return () => setHeaderContent(null);
  }, [title, breadcrumb, setHeaderContent]);

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: token.colorBgLayout,
      }}
    >
      <Empty
        description={
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                fontSize: '19px',
                fontWeight: 600,
                color: token.colorText,
                marginBottom: '8px',
              }}
            >
              {title}
            </div>
            <div style={{ color: token.colorTextSecondary, fontSize: '13px' }}>
              이 페이지는 준비 중입니다.
            </div>
          </div>
        }
      />
    </div>
  );
};

export default EmptyPage;

