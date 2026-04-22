import React, { useState, useEffect } from 'react';
import MainLayout from './components/layout/MainLayout';
import Dashboard from './pages/Dashboard';
import MyBoard from './pages/MyBoard';
import SarTable from './pages/SarTable';
import SynthesisBoard from './pages/SynthesisBoard';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState('dashboard');

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
      case 'sar-table':
        return <SarTable />;
      case 'synthesis-board':
        return <SynthesisBoard />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <MainLayout>
      {renderPage()}
    </MainLayout>
  );
};

export default App;
