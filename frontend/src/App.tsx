import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { App as AntApp, ConfigProvider, theme } from 'antd';
import { useTheme } from './contexts/ThemeContext';
import MainLayout from './components/layout/MainLayout';
import Dashboard from './pages/Dashboard';
import MyBoard from './pages/MyBoard';
import MyBoardSynthesisBoard from './pages/MyBoardSynthesisBoard';
import SarTable from './pages/SarTable';
import ChemSpace from './pages/ChemSpace';
import ChemSpace3D from './pages/ChemSpace3D';
import ReactionPredictor from './pages/ReactionPredictor';
import PatentAnalysisList from './pages/PatentAnalysisList';
import PatentAnalysisDetail from './pages/PatentAnalysisDetail';
import PatentInsight from './pages/PatentInsight';
import DevelopmentStatus from './pages/DevelopmentStatus';
import Monitoring from './pages/Monitoring';
import EmptyPage from './pages/EmptyPage';
import UniversalSearch from './pages/UniversalSearch';
import AuthGate from './components/auth/AuthGate';
import AccessRegistry from './pages/AccessRegistry';
import Contact from './pages/Contact';

const App: React.FC = () => {
  const { isDarkMode } = useTheme();

  return (
    <ConfigProvider
      theme={{
        algorithm: isDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: '#F87C63',
          borderRadius: 12,
          fontSize: 13,
          fontSizeSM: 11,
          fontSizeLG: 15,
          fontSizeXL: 19,
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          colorBgLayout: isDarkMode ? '#141414' : '#f7f9fb',
          colorBorder: isDarkMode ? '#434343' : '#d8dbe0',
          colorBorderSecondary: isDarkMode ? '#303030' : '#f0f0f0',
          lineWidth: 1,
        },
        components: {
          Card: {
            borderRadiusLG: 12,
            boxShadow: isDarkMode ? 'none' : '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)',
          },
          Table: {
            borderRadius: 12,
            headerBg: isDarkMode ? '#2a2a2a' : '#edf0f3',
            headerColor: isDarkMode ? 'rgba(255,255,255,0.85)' : '#495057',
            rowHoverBg: isDarkMode ? 'rgba(248, 124, 99, 0.18)' : 'rgba(248, 124, 99, 0.12)',
          },
          Input: {
            borderRadius: 12,
            controlHeight: 40,
          },
          Select: {
            borderRadius: 12,
            controlHeight: 40,
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
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AntApp>
          <AuthGate>
            <MainLayout>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/design" element={<MyBoard />} />
              <Route path="/synthesis" element={<EmptyPage title="Synthesis" breadcrumb={[{ label: 'Synthesis' }]} />} />
              <Route path="/myboard" element={<MyBoard />} />
              <Route path="/compounds/search" element={<EmptyPage title="Search" breadcrumb={[{ label: 'Compounds' }, { label: 'Search' }]} />} />
              <Route path="/my-tree" element={<EmptyPage title="My tree" breadcrumb={[{ label: 'Compounds' }, { label: 'My tree' }]} />} />
              <Route path="/chem-space" element={<ChemSpace />} />
              <Route path="/chem-space-3d" element={<ChemSpace3D />} />
              <Route path="/clustering" element={<EmptyPage title="Clustering" breadcrumb={[{ label: 'Compounds' }, { label: 'Clustering' }]} />} />
              <Route path="/reaction-predictor" element={<ReactionPredictor />} />
              <Route path="/myboard/sar-table" element={<SarTable />} />
              <Route path="/myboard/synthesis-board" element={<MyBoardSynthesisBoard />} />
              <Route path="/sar-table" element={<Navigate to="/myboard/sar-table" replace />} />
              <Route path="/synthesis-board" element={<Navigate to="/myboard/synthesis-board" replace />} />
              <Route path="/patents/write" element={<EmptyPage title="My 특허 쓰기" breadcrumb={[{ label: 'Documents' }, { label: 'Patents' }, { label: 'My 특허 쓰기' }]} />} />
              <Route path="/patents/analysis" element={<PatentAnalysisList />} />
              <Route path="/patents/analysis/:id" element={<PatentAnalysisDetail />} />
              <Route path="/patents/insight" element={<PatentInsight />} />
              <Route path="/patents/manage" element={<EmptyPage title="My 특허 관리" breadcrumb={[{ label: 'Documents' }, { label: 'Patents' }, { label: 'My 특허 관리' }]} />} />
              <Route path="/papers/manage" element={<EmptyPage title="My 논문 관리" breadcrumb={[{ label: 'Documents' }, { label: 'Papers' }, { label: 'My 논문 관리' }]} />} />
              <Route path="/conferences" element={<EmptyPage title="Conferences" breadcrumb={[{ label: 'Documents' }, { label: 'Conferences' }]} />} />
              <Route path="/pdbs" element={<EmptyPage title="PDBs" breadcrumb={[{ label: 'PDBs' }]} />} />
              <Route path="/universal-search" element={<UniversalSearch />} />
              <Route path="/monitoring" element={<Monitoring />} />
              <Route path="/development-status" element={<DevelopmentStatus />} />
              <Route path="/workspace/access-registry" element={<AccessRegistry />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
            </MainLayout>
          </AuthGate>
        </AntApp>
      </Router>
    </ConfigProvider>
  );
};

export default App;
