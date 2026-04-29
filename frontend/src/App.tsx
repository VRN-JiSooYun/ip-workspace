import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import { useTheme } from './contexts/ThemeContext';
import MainLayout from './components/layout/MainLayout';
import Dashboard from './pages/Dashboard';
import MyBoard from './pages/MyBoard';
import SarTable from './pages/SarTable';
import SynthesisBoard from './pages/SynthesisBoard';
import EmptyPage from './pages/EmptyPage';

const App: React.FC = () => {
  const { isDarkMode } = useTheme();

  return (
    <ConfigProvider
      theme={{
        algorithm: isDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: '#F87C63',
          borderRadius: 8,
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          colorBgLayout: isDarkMode ? '#141414' : '#f7f9fb',
        },
        components: {
          Card: {
            borderRadiusLG: 2,
            boxShadow: isDarkMode ? 'none' : '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)',
          },
          Layout: {
            bodyBg: isDarkMode ? '#141414' : '#f8f9fa',
            headerBg: isDarkMode ? '#1f1f1f' : '#fff',
            siderBg: isDarkMode ? '#1f1f1f' : '#fff',
          },
          Menu: {
            itemBg: 'transparent',
            itemSelectedBg: isDarkMode ? '#2b2b2b' : '#ffffff',
            itemSelectedColor: '#F87C63',
            itemHoverBg: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
          },
          Button: {
            borderRadius: 12,
            controlHeight: 40,
          }
        },
      }}
    >
      <Router>
        <MainLayout>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/myboard" element={<MyBoard />} />
            <Route path="/my-tree" element={<EmptyPage title="My tree" />} />
            <Route path="/sar-table" element={<SarTable />} />
            <Route path="/synthesis-board" element={<SynthesisBoard />} />
            <Route path="/patents/write" element={<EmptyPage title="My 특허 쓰기" />} />
            <Route path="/patents/analysis" element={<EmptyPage title="My 특허 분석" />} />
            <Route path="/patents/manage" element={<EmptyPage title="My 특허 관리" />} />
            <Route path="/papers/manage" element={<EmptyPage title="My 논문 관리" />} />
            <Route path="/conferences" element={<EmptyPage title="Conferences" />} />
            <Route path="/pdbs" element={<EmptyPage title="PDBs" />} />
            <Route path="/universal-search" element={<EmptyPage title="통합검색" />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </MainLayout>
      </Router>
    </ConfigProvider>
  );
};

export default App;
