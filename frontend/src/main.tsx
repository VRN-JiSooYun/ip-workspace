import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider, theme } from 'antd';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#F87C63', // Zenith Orange/Coral
          borderRadius: 8,
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          colorBgBody: '#f7f9fb',
        },
        components: {
          Card: {
            borderRadiusLG: 2,
            boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)',
          },
          Layout: {
            bodyBg: '#f8f9fa',
            headerBg: '#fff', // White Header
            siderBg: '#fff', // White SideBar
          },
          Menu: {
            itemBg: 'transparent',
            itemSelectedBg: '#ffffff',
            itemSelectedColor: '#F87C63',
            itemHoverBg: 'rgba(0, 0, 0, 0.04)',
          },
          Button: {
            borderRadius: 12,
            controlHeight: 40,
          }
        },
      }}
    >
      <App />
    </ConfigProvider>
  </React.StrictMode>
);
