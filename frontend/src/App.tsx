import React, { useState, useEffect } from 'react';
import { ConfigProvider, theme } from 'antd';
import { useTheme } from './contexts/ThemeContext';
import MainLayout from './components/layout/MainLayout';
import Dashboard from './pages/Dashboard';
import MyBoard from './pages/MyBoard';
import SarTable from './pages/SarTable';
import SynthesisBoard from './pages/SynthesisBoard';
import EmptyPage from './pages/EmptyPage';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const { isDarkMode } = useTheme();

  useEffect(() => {
    (window as any).onNavigate = (key: string) => {
      setCurrentPage(key);
    };
  }, []);

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'myboard':
        return <MyBoard />;
      case 'my-tree':
        return <EmptyPage title="My tree" />;
      case 'sar-table':
        return <SarTable />;
      case 'synthesis-board':
        return <SynthesisBoard />;
      case 'patents':
      case 'patent-write':
        return <EmptyPage title="My 특허 쓰기" />;
      case 'patent-analysis':
        return <EmptyPage title="My 특허 분석" />;
      case 'patent-manage':
        return <EmptyPage title="My 특허 관리" />;
      case 'papers':
      case 'paper-manage':
        return <EmptyPage title="My 논문 관리" />;
      case 'conferences':
        return <EmptyPage title="Conferences" />;
      case 'pdbs':
        return <EmptyPage title="PDBs" />;
      case 'universal-search':
        return <EmptyPage title="통합검색" />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <ConfigProvider
      theme={{
        algorithm: isDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: '#F87C63',
          borderRadius: 8,
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          colorBgBody: isDarkMode ? '#141414' : '#f7f9fb',
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
      <MainLayout>
        {renderPage()}
      </MainLayout>
    </ConfigProvider>
  );
};

export default App;
