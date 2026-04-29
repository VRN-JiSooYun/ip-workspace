import React from 'react';
import { Empty } from 'antd';
import { theme } from 'antd';

interface EmptyPageProps {
  title?: string;
}

const EmptyPage: React.FC<EmptyPageProps> = ({ title = 'Coming Soon' }) => {
  const { token } = theme.useToken();

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 'calc(100vh - 80px)',
        background: token.colorBgLayout,
      }}
    >
      <Empty
        description={
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                fontSize: '20px',
                fontWeight: 600,
                color: token.colorText,
                marginBottom: '8px',
              }}
            >
              {title}
            </div>
            <div style={{ color: token.colorTextSecondary, fontSize: '14px' }}>
              이 페이지는 준비 중입니다.
            </div>
          </div>
        }
      />
    </div>
  );
};

export default EmptyPage;

