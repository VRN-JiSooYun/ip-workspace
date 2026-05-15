import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Button, theme, Input, Avatar, Badge, Space } from 'antd';
import { useTheme } from '../../contexts/ThemeContext';
import {
  LayoutDashboard,
  FlaskConical,
  Beaker,
  Table as TableIcon,
  Search,
  Bell,
  Moon,
  Sun,
  LogOut,
  Plus,
  Palette,
  Activity,
  PlusSquare,
  Microscope,
  Menu as MenuIcon,
  PanelLeftClose,
  PanelLeftOpen,
  FileText,
  BookOpen,
  Users as UsersIcon,
  HelpCircle
} from 'lucide-react';
import BenzeneIcon from '../common/BenzeneIcon';

const { Header, Sider, Content } = Layout;

interface MainLayoutProps {
  children: React.ReactNode;
}

import { useUIStore } from '../../store/useUIStore';

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const [sidebarMode, setSidebarMode] = useState<'full' | 'mini' | 'hidden'>('full');
  const { token } = theme.useToken();
  const { isDarkMode, toggleTheme } = useTheme();
  const { headerContent } = useUIStore();
  const navigate = useNavigate();
  const location = useLocation();

  // URL 경로에서 메뉴 키 추출 (예: /dashboard -> dashboard, /patents/write -> patent-write)
  const getSelectedKey = () => {
    const path = location.pathname;
    if (path === '/dashboard') return 'dashboard';
    if (path === '/myboard') return 'myboard';
    if (path === '/my-tree') return 'my-tree';
    if (path === '/chem-space') return 'chem-space';
    if (path === '/patents/write') return 'patent-write';
    if (path === '/patents/analysis') return 'patent-analysis';
    if (path === '/patents/manage') return 'patent-manage';
    if (path === '/papers/manage') return 'paper-manage';
    if (path === '/conferences') return 'conferences';
    if (path === '/pdbs') return 'pdbs';
    if (path === '/universal-search') return 'universal-search';
    if (path === '/development-status') return 'development-status';
    if (path === '/contact') return 'contact';
    return 'dashboard';
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={sidebarMode !== 'full'}
        collapsedWidth={sidebarMode === 'hidden' ? 0 : 64}
        theme={isDarkMode ? 'dark' : 'light'}
        width={220}
        style={{
          background: isDarkMode ? '#1a1a1a' : '#f2f4f6',
          padding: sidebarMode === 'full' ? '24px 12px' : (sidebarMode === 'mini' ? '24px 0' : 0),
          borderRight: isDarkMode ? '1px solid #303030' : 'none',
          transition: 'all 0.2s',
          overflow: 'hidden'
        }}
      >
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px', 
          padding: '0 16px', 
          marginBottom: 40, 
          position: 'relative',
          opacity: sidebarMode === 'hidden' ? 0 : 1,
          transition: 'opacity 0.2s'
        }}>
          <div style={{
            width: 40,
            height: 40,
            background: '#F87C63',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            flexShrink: 0
          }} onClick={() => navigate('/dashboard')} className="cursor-pointer">
            <FlaskConical size={24} />
          </div>
          {sidebarMode === 'full' && (
            <div onClick={() => navigate('/dashboard')} style={{ cursor: 'pointer' }}>
              <div style={{ fontWeight: 800, fontSize: '18px', color: isDarkMode ? '#e8e8e8' : '#191c1e', letterSpacing: '-0.5px' }}>MyWorkspace</div>
            </div>
          )}
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: '0 8px', display: sidebarMode === 'hidden' ? 'none' : 'block' }}>
          <Menu
            mode="inline"
            selectedKeys={[getSelectedKey()]}
            style={{ background: 'transparent', borderRight: 0 }}
            items={[
              {
                key: 'dashboard',
                icon: <LayoutDashboard size={22} />,
                label: <span style={{ fontWeight: 600 }}>Dashboard</span>,
                onClick: () => navigate('/dashboard')
              },
              {
                key: 'compounds',
                icon: <BenzeneIcon size={22} />,
                label: <span style={{ fontWeight: 600 }}>Compounds</span>,
                children: [
                  { key: 'myboard', label: 'My board', onClick: () => navigate('/myboard') },
                  { key: 'my-tree', label: 'My tree', onClick: () => navigate('/my-tree') },
                  { key: 'chem-space', label: 'Chem Space', onClick: () => navigate('/chem-space') },
                ],
              },
              {
                key: 'documents',
                icon: <FileText size={22} />,
                label: <span style={{ fontWeight: 600 }}>Documents</span>,
                children: [
                  {
                    key: 'patents',
                    label: 'Patents',
                    children: [
                      { key: 'patent-write', label: 'My 특허 쓰기', onClick: () => navigate('/patents/write') },
                      { key: 'patent-analysis', label: 'My 특허 분석', onClick: () => navigate('/patents/analysis') },
                      { key: 'patent-manage', label: 'My 특허 관리', onClick: () => navigate('/patents/manage') },
                    ]
                  },
                  {
                    key: 'papers',
                    label: 'Papers',
                    children: [
                      { key: 'paper-manage', label: 'My 논문 관리', onClick: () => navigate('/papers/manage') },
                    ]
                  },
                  { key: 'conferences', label: 'Conferences', onClick: () => navigate('/conferences') },
                ],
              },
              {
                key: 'pdbs',
                icon: <Microscope size={22} />,
                label: <span style={{ fontWeight: 600 }}>PDBs</span>,
                onClick: () => navigate('/pdbs')
              },
              {
                key: 'universal-search',
                icon: <Search size={22} />,
                label: <span style={{ fontWeight: 600 }}>통합검색</span>,
                onClick: () => navigate('/universal-search')
              },
              {
                key: 'development-status',
                icon: <Activity size={22} />,
                label: <span style={{ fontWeight: 600 }}>수리응용2팀 서비스 개발 진행 현황</span>,
                onClick: () => navigate('/development-status')
              },
              {
                key: 'contact',
                icon: <HelpCircle size={22} />,
                label: <span style={{ fontWeight: 600 }}>문의하기</span>,
                onClick: () => navigate('/contact')
              },
            ]}
          />
        </div>
      </Sider>

      <Layout>
        <Header style={{
          padding: '0 32px',
          background: token.colorBgLayout,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 80,
          borderBottom: 'none'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', flex: 1, gap: 16 }}>
            <Button
              type="text"
              icon={
                sidebarMode === 'full' ? <PanelLeftClose size={20} /> :
                sidebarMode === 'mini' ? <PanelLeftOpen size={20} /> :
                <MenuIcon size={20} />
              }
              onClick={() => {
                if (sidebarMode === 'full') setSidebarMode('mini');
                else if (sidebarMode === 'mini') setSidebarMode('hidden');
                else setSidebarMode('full');
              }}
              style={{
                width: 40,
                height: 40,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '10px',
                background: isDarkMode ? '#2b2b2b' : '#fff',
                boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
              }}
            />
            {headerContent ? (
              headerContent
            ) : (
              <div style={{ position: 'relative' }}>
                <Input
                  prefix={<Search size={18} color={token.colorTextPlaceholder} />}
                  placeholder="Search workspace..."
                  style={{
                    width: 256,
                    border: 'none',
                    background: isDarkMode ? '#2b2b2b' : '#f2f4f6',
                    borderRadius: '12px',
                    height: 40,
                    fontSize: '14px',
                    color: token.colorText
                  }}
                />
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <Space size={16}>
              <Button type="text" icon={<Bell size={20} color={token.colorTextSecondary} />} />
              <Button type="text" onClick={toggleTheme} icon={
                isDarkMode ? <Sun size={20} color={token.colorTextSecondary} /> : <Moon size={20} color={token.colorTextSecondary} />
              } />
              <Button type="text" icon={<Palette size={20} color={token.colorTextSecondary} />} />
            </Space>
            <Avatar
              size={40}
              style={{ border: '2px solid #fff', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuBxWmRUEECaG6CTx1WD3R6_8tUqDHhik8dPVS9z33QnH2x1bZtxqt1emWmHOe6YQhE0Tdxp0BfK-IHXkmDk80y_bQdUI5-L55LwZgvDpwTRZwliugh2EnhkA3G3LJFkpA-ssVst9nIo4rq7NQuh5-pKHFOCJmkWJm5RAotHti-bhlBgsoCQ9s5wdtPOBTxJYx5Btz5wsJUbTNvKM-9kUYAPXUWMygQZKaQ10jfVrjbmx_ehGPDkYzwz1WxONu-0c0eXnBoEppPlsOgB"
            />
          </div>
        </Header>
        <Content style={{
          padding: '0 32px 24px 32px',
          overflow: 'hidden', // 전체 스크롤 방지를 위해 hidden으로 변경
          boxSizing: 'border-box',
          height: 'calc(100vh - 80px)',
          maxHeight: 'calc(100vh - 80px)', // 높이 팽창 방지
          backgroundColor: token.colorBgLayout,
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            {children}
          </div>
        </Content>
      </Layout>
      <style>{`
        .ant-menu-item-selected { 
          background-color: ${isDarkMode ? '#2b2b2b' : '#ffffff'} !important; 
          color: #F87C63 !important; 
          border-radius: 12px !important;
          box-shadow: ${isDarkMode ? 'none' : '0 4px 6px -1px rgb(0 0 0 / 0.1)'} !important;
        }
        .ant-menu-item { 
          border-radius: 12px !important; 
          margin-bottom: 4px !important; 
          height: 48px !important;
          display: flex !important;
          align-items: center !important;
        }
        .ant-menu-inline .ant-menu-sub.ant-menu-inline { background: transparent !important; }
        .ant-menu-submenu-title { border-radius: 12px !important; height: 48px !important; display: flex !important; align-items: center !important; }
        .cursor-pointer { cursor: pointer; }
      `}</style>
      <style>{`
        html, body, #root {
          height: 100vh !important;
          width: 100vw !important;
          overflow: hidden !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        .ant-layout {
          height: 100vh !important;
          overflow: hidden !important;
        }
      `}</style>
    </Layout>
  );
};

export default MainLayout;
