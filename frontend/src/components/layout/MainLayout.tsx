import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Button, theme, Input, Avatar, Space, Select, Tag } from 'antd';
import { useTheme } from '../../contexts/ThemeContext';
import {
  LayoutDashboard,
  FlaskConical,
  Search,
  Bell,
  Moon,
  Sun,
  Palette,
  Activity,
  Microscope,
  Box,
  Menu as MenuIcon,
  PanelLeftClose,
  FileText,
  HelpCircle
} from 'lucide-react';
import BenzeneIcon from '../common/BenzeneIcon';
import { useUserStore } from '../../store/useUserStore';

const { Header, Sider, Content } = Layout;

interface MainLayoutProps {
  children: React.ReactNode;
}

import { useUIStore } from '../../store/useUIStore';

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const [sidebarMode, setSidebarMode] = useState<'full' | 'mini' | 'hidden'>('full');
  const [viewportWidth, setViewportWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return 1920;
    return window.innerWidth;
  });
  const { token } = theme.useToken();
  const { isDarkMode, toggleTheme } = useTheme();
  const { headerContent } = useUIStore();
  const { users, currentUserId, currentUser, setCurrentUserId } = useUserStore();
  const navigate = useNavigate();
  const location = useLocation();
  const isStackedHeader = viewportWidth <= 900;
  const headerHeight = isStackedHeader ? 128 : 80;
  const voraExternalUrl = 'https://voronoi.app/vora/';

  React.useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // URL 경로에서 메뉴 키 추출 (예: /dashboard -> dashboard, /patents/write -> patent-write)
  const getSelectedKey = () => {
    const path = location.pathname;
    if (path === '/dashboard') return 'dashboard';
    if (path === '/myboard') return 'myboard';
    if (path === '/myboard/sar-table' || path === '/sar-table') return 'myboard';
    if (path === '/myboard/synthesis-board' || path === '/synthesis-board') return 'myboard';
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
        className="app-sidebar"
        trigger={null}
        collapsible
        collapsed={sidebarMode !== 'full'}
        collapsedWidth={sidebarMode === 'hidden' ? 0 : 64}
        theme={isDarkMode ? 'dark' : 'light'}
        width={220}
        style={{
          background: isDarkMode ? '#1a1a1a' : '#f2f4f6',
          padding: sidebarMode === 'full' ? '24px 2px' : (sidebarMode === 'mini' ? '24px 0' : 0),
          borderRight: isDarkMode ? '1px solid #303030' : 'none',
          transition: 'all 0.2s',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          height: '100vh'
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '0 12px',
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

        <div style={{ overflowY: 'auto', flex: '1 1 auto', minHeight: 0, padding: '0 8px', display: sidebarMode === 'hidden' ? 'none' : 'block' }}>
          <Button
            block
            icon={<Box size={18} />}
            onClick={() => window.open(voraExternalUrl, '_blank', 'noopener,noreferrer')}
            style={{
              height: 44,
              marginBottom: 30,
              justifyContent: sidebarMode === 'full' ? 'flex-start' : 'center',
              paddingInline: sidebarMode === 'full' ? 16 : 0,
              background: isDarkMode ? '#242424' : '#ffffff',
              borderColor: isDarkMode ? token.colorBorder : '#d8dbe0',
              color: token.colorText,
              fontWeight: 600,
              borderRadius: 12,
              boxShadow: isDarkMode ? 'none' : '0 1px 2px rgba(15, 23, 42, 0.06)',
            }}
          >
            {sidebarMode === 'full' ? 'VORA' : null}
          </Button>
          <Menu
            mode="inline"
            inlineIndent={12}
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
                  { key: 'chem-space', label: 'Chemical space', onClick: () => navigate('/chem-space') },
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
            ]}
          />
        </div>

        <div style={{ marginTop: 'auto', padding: '12px 8px 0', flexShrink: 0, display: sidebarMode === 'hidden' ? 'none' : 'block' }}>
          <Menu
            mode="inline"
            inlineIndent={12}
            selectedKeys={[getSelectedKey()]}
            style={{ background: 'transparent', borderRight: 0 }}
            items={[
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
          padding: isStackedHeader ? '12px 20px' : '0 32px',
          background: token.colorBgLayout,
          display: 'flex',
          flexDirection: isStackedHeader ? 'column' : 'row',
          alignItems: isStackedHeader ? 'stretch' : 'center',
          justifyContent: 'space-between',
          gap: isStackedHeader ? 10 : 0,
          height: headerHeight,
          borderBottom: 'none'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', flex: isStackedHeader ? '0 0 auto' : '1 1 auto', minWidth: 0, width: isStackedHeader ? '100%' : undefined, gap: 16, overflow: isStackedHeader ? 'visible' : 'hidden' }}>
            <Button
              type="text"
              icon={
                sidebarMode === 'full' || sidebarMode === 'mini' ? <PanelLeftClose size={20} /> :
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
              <div style={{ minWidth: 0, flex: '1 1 auto', overflowX: isStackedHeader ? 'auto' : 'hidden', overflowY: 'hidden', whiteSpace: 'nowrap' }}>
                {headerContent}
              </div>
            ) : (
              <div style={{ position: 'relative', minWidth: 0, flex: '1 1 180px', maxWidth: 256 }}>
                <Input
                  prefix={<Search size={18} color={token.colorTextPlaceholder} />}
                  placeholder="Search workspace..."
                  style={{
                    width: '100%',
                    minWidth: 0,
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

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: isStackedHeader ? 'flex-end' : 'flex-start', gap: isStackedHeader ? 12 : 24, flexShrink: 0, width: isStackedHeader ? '100%' : undefined, minWidth: 0 }}>
            <Space size={isStackedHeader ? 8 : 16}>
              <Button type="text" icon={<Bell size={20} color={token.colorTextSecondary} />} />
              <Button type="text" onClick={toggleTheme} icon={
                isDarkMode ? <Sun size={20} color={token.colorTextSecondary} /> : <Moon size={20} color={token.colorTextSecondary} />
              } />
              <Button type="text" icon={<Palette size={20} color={token.colorTextSecondary} />} />
            </Space>
            <Select
              value={currentUserId}
              onChange={setCurrentUserId}
              style={{ width: isStackedHeader ? 168 : 188 }}
              popupMatchSelectWidth={240}
              optionLabelProp="label"
              options={users.map((user) => ({
                value: user.id,
                label: `${user.name} · ${user.team}`,
              }))}
              optionRender={(option) => {
                const user = users.find((item) => item.id === option.value);
                if (!user) return option.label;

                return (
                  <Space size={8}>
                    <Avatar size={24}>{user.name.slice(0, 1)}</Avatar>
                    <span>{user.name}</span>
                    <Tag color={user.role === 'design' ? 'orange' : 'blue'} style={{ margin: 0 }}>
                      {user.team}
                    </Tag>
                  </Space>
                );
              }}
            />
            <Avatar
              size={40}
              style={{ border: '2px solid #fff', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', background: token.colorPrimary }}
            >
              {currentUser.name.slice(0, 1)}
            </Avatar>
          </div>
        </Header>
        <Content style={{
          padding: '0 12px 24px 12px',
          overflow: 'hidden', // 전체 스크롤 방지를 위해 hidden으로 변경
          boxSizing: 'border-box',
          height: `calc(100vh - ${headerHeight}px)`,
          maxHeight: `calc(100vh - ${headerHeight}px)`, // 높이 팽창 방지
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
        .ant-menu-inline .ant-menu-sub.ant-menu-inline { background: transparent !important; margin-left: 22px !important; }
        .ant-menu-submenu-title { border-radius: 12px !important; height: 48px !important; display: flex !important; align-items: center !important; }
        .cursor-pointer { cursor: pointer; }
        .app-sidebar .ant-layout-sider-children {
          height: 100%;
          min-height: 0;
          display: flex;
          flex-direction: column;
        }
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
