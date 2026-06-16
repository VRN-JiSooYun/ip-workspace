import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Button, theme, Input, Avatar, Space, Select, Tag, Dropdown, Tooltip } from 'antd';
import type { MenuProps } from 'antd';
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

interface MiniMenuItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  onClick?: () => void;
  menu?: MenuProps;
  activeKeys?: string[];
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

  const renderSidebarIcon = (icon: React.ReactNode) => (
    <span className="sidebar-menu-icon">{icon}</span>
  );

  const renderMiniDropdownLabel = (label: string) => (
    <span className="mini-dropdown-label" title="">{label}</span>
  );

  const miniMenuButtonStyle = (selected: boolean): React.CSSProperties => ({
    width: 40,
    height: 40,
    margin: '0 auto 2px',
    padding: 0,
    border: 'none',
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: selected ? '#F87C63' : token.colorText,
    background: selected ? (isDarkMode ? '#2b2b2b' : '#ffffff') : 'transparent',
    boxShadow: selected && !isDarkMode ? '0 4px 6px -1px rgb(0 0 0 / 0.1)' : 'none',
  });

  const mainMiniMenuItems: MiniMenuItem[] = [
    {
      key: 'dashboard',
      label: 'Dashboard',
      icon: <LayoutDashboard size={22} />,
      onClick: () => navigate('/dashboard'),
    },
    {
      key: 'design',
      label: 'Design',
      icon: <Palette size={22} />,
      activeKeys: ['design', 'myboard'],
      onClick: () => navigate('/design'),
    },
    {
      key: 'synthesis',
      label: 'Synthesis',
      icon: <Microscope size={22} />,
      activeKeys: ['synthesis'],
      onClick: () => navigate('/synthesis'),
    },
    {
      key: 'documents',
      label: 'Documents',
      icon: <FileText size={22} />,
      activeKeys: ['documents', 'patents', 'patent-write', 'patent-analysis', 'patent-insight', 'patent-manage', 'papers', 'paper-manage', 'conferences'],
      menu: {
        items: [
          {
            key: 'patents',
            label: renderMiniDropdownLabel('Patents'),
            title: '',
            popupClassName: 'app-sidebar-popup-menu',
            children: [
              { key: 'patent-write', label: renderMiniDropdownLabel('My 특허 쓰기'), title: '', onClick: () => navigate('/patents/write') },
              { key: 'patent-analysis', label: renderMiniDropdownLabel('My 특허 분석'), title: '', onClick: () => navigate('/patents/analysis') },
              { key: 'patent-insight', label: renderMiniDropdownLabel('Insight'), title: '', onClick: () => navigate('/patents/insight') },
              { key: 'patent-manage', label: renderMiniDropdownLabel('My 특허 관리'), title: '', onClick: () => navigate('/patents/manage') },
            ],
          },
          {
            key: 'papers',
            label: renderMiniDropdownLabel('Papers'),
            title: '',
            popupClassName: 'app-sidebar-popup-menu',
            children: [
              { key: 'paper-manage', label: renderMiniDropdownLabel('My 논문 관리'), title: '', onClick: () => navigate('/papers/manage') },
            ],
          },
          { key: 'conferences', label: renderMiniDropdownLabel('Conferences'), title: '', onClick: () => navigate('/conferences') },
        ],
      },
    },
    {
      key: 'compounds',
      label: 'Compounds',
      icon: <BenzeneIcon size={22} />,
      activeKeys: ['compounds', 'compound-search', 'chem-space', 'clustering'],
      menu: {
        items: [
          { key: 'compound-search', label: renderMiniDropdownLabel('Search'), title: '', onClick: () => navigate('/compounds/search') },
          { key: 'chem-space', label: renderMiniDropdownLabel('Chemical space'), title: '', onClick: () => navigate('/chem-space') },
          { key: 'clustering', label: renderMiniDropdownLabel('Clustering'), title: '', onClick: () => navigate('/clustering') },
        ],
      },
    },
    {
      key: 'tools',
      label: 'Tools',
      icon: <FlaskConical size={22} />,
      activeKeys: ['tools', 'reaction-predictor'],
      menu: {
        items: [
          { key: 'reaction-predictor', label: renderMiniDropdownLabel('Reaction Site Predictor'), title: '', onClick: () => navigate('/reaction-predictor') },
        ],
      },
    },
    {
      key: 'universal-search',
      label: '통합검색',
      icon: <Search size={22} />,
      onClick: () => navigate('/universal-search'),
    },
  ];

  const bottomMiniMenuItems: MiniMenuItem[] = [
    {
      key: 'development-status',
      label: '수리응용2팀 서비스 개발 진행 현황',
      icon: <Activity size={22} />,
      onClick: () => navigate('/development-status'),
    },
    {
      key: 'contact',
      label: '문의하기',
      icon: <HelpCircle size={22} />,
      onClick: () => navigate('/contact'),
    },
  ];

  // URL 경로에서 메뉴 키 추출 (예: /dashboard -> dashboard, /patents/write -> patent-write)
  const getSelectedKey = () => {
    const path = location.pathname;
    if (path === '/dashboard') return 'dashboard';
    if (path === '/design' || path === '/myboard') return 'design';
    if (path === '/synthesis' || path === '/myboard/synthesis-board' || path === '/synthesis-board') return 'synthesis';
    if (path === '/myboard/sar-table' || path === '/sar-table') return 'design';
    if (path === '/compounds/search' || path === '/my-tree') return 'compound-search';
    if (path === '/chem-space') return 'chem-space';
    if (path === '/clustering') return 'clustering';
    if (path === '/reaction-predictor') return 'reaction-predictor';
    if (path === '/patents/write') return 'patent-write';
    if (path === '/patents/analysis' || path.startsWith('/patents/analysis/')) return 'patent-analysis';
    if (path === '/patents/insight') return 'patent-insight';
    if (path === '/patents/manage') return 'patent-manage';
    if (path === '/papers/manage') return 'paper-manage';
    if (path === '/conferences') return 'conferences';
    if (path === '/universal-search') return 'universal-search';
    if (path === '/development-status') return 'development-status';
    if (path === '/contact') return 'contact';
    return 'dashboard';
  };

  const isMiniItemSelected = (item: MiniMenuItem) => {
    const selectedKey = getSelectedKey();
    return item.key === selectedKey || item.activeKeys?.includes(selectedKey) === true;
  };

  const getMiniDropdownMenu = (item: MiniMenuItem): MenuProps => ({
    ...item.menu,
    className: 'app-sidebar-dropdown-menu',
    style: { minWidth: 200 },
    items: [
      { key: `${item.key}-title`, label: renderMiniDropdownLabel(item.label), title: '', disabled: true, className: 'mini-menu-popup-title' },
      { type: 'divider' },
      ...(item.menu?.items ?? []),
    ],
  });

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        className={`app-sidebar app-sidebar-${sidebarMode}`}
        trigger={null}
        collapsible
        collapsed={sidebarMode !== 'full'}
        collapsedWidth={sidebarMode === 'hidden' ? 0 : 64}
        theme={isDarkMode ? 'dark' : 'light'}
        width={220}
        style={{
          background: isDarkMode ? '#1a1a1a' : '#f2f4f6',
          padding: sidebarMode === 'full' ? '18px 2px' : (sidebarMode === 'mini' ? '18px 0' : 0),
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
          marginBottom: 28,
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
              <div style={{ fontWeight: 800, fontSize: '17px', color: isDarkMode ? '#e8e8e8' : '#191c1e', letterSpacing: '-0.5px' }}>MyWorkspace</div>
            </div>
          )}
        </div>

        <div style={{ overflowY: 'auto', flex: '1 1 auto', minHeight: 0, padding: '0 8px', display: sidebarMode === 'hidden' ? 'none' : 'block' }}>
          <Tooltip title={sidebarMode === 'mini' ? 'VORA' : ''} placement="right">
            <Button
              className="vora-link-button"
              onClick={() => window.open(voraExternalUrl, '_blank', 'noopener,noreferrer')}
              style={{
                height: 34,
                width: sidebarMode === 'full' ? 'calc(100% - 24px)' : 34,
                marginLeft: sidebarMode === 'full' ? 12 : 'auto',
                marginRight: sidebarMode === 'full' ? 0 : 'auto',
                marginBottom: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                paddingInline: sidebarMode === 'full' ? 16 : 0,
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 10,
                boxShadow: 'none',
              }}
            >
              {sidebarMode === 'full' ? 'VORA' : 'V'}
            </Button>
          </Tooltip>
          <Tooltip title={sidebarMode === 'mini' ? 'Medichem ELN' : ''} placement="right">
            <Button
              className="medichem-eln-link-button"
              style={{
                height: 34,
                width: sidebarMode === 'full' ? 'calc(100% - 24px)' : 34,
                marginLeft: sidebarMode === 'full' ? 12 : 'auto',
                marginRight: sidebarMode === 'full' ? 0 : 'auto',
                marginBottom: 18,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                paddingInline: sidebarMode === 'full' ? 16 : 0,
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 10,
                boxShadow: 'none',
              }}
            >
              {sidebarMode === 'full' ? 'Medichem ELN' : 'M'}
            </Button>
          </Tooltip>
          <div
            style={{
              height: 1,
              margin: sidebarMode === 'full' ? '0 4px 14px 12px' : '0 8px 14px',
              background: isDarkMode ? '#303030' : '#d8dbe0',
            }}
          />
          {sidebarMode === 'mini' ? (
            <div className="mini-menu-rail">
              {mainMiniMenuItems.map((item) => {
                const button = (
                  <Button
                    key={item.key}
                    type="text"
                    aria-label={item.label}
                    style={miniMenuButtonStyle(isMiniItemSelected(item))}
                    onClick={item.onClick}
                  >
                    {item.icon}
                  </Button>
                );

                if (!item.menu) {
                  return (
                    <Tooltip key={item.key} title={item.label} placement="right">
                      {button}
                    </Tooltip>
                  );
                }

                return (
                  <Dropdown
                    key={item.key}
                    menu={getMiniDropdownMenu(item)}
                    placement="topLeft"
                    trigger={['hover']}
                    overlayClassName="app-sidebar-popup-menu"
                  >
                    {button}
                  </Dropdown>
                );
              })}
            </div>
          ) : (
            <Menu
              mode="inline"
              inlineIndent={8}
              selectedKeys={[getSelectedKey()]}
              style={{ background: 'transparent', borderRight: 0 }}
              items={[
              {
                key: 'dashboard',
                icon: renderSidebarIcon(<LayoutDashboard size={22} />),
                label: <span style={{ fontWeight: 600 }}>Dashboard</span>,
                onClick: () => navigate('/dashboard')
              },
              {
                key: 'design',
                icon: renderSidebarIcon(<Palette size={22} />),
                label: <span style={{ fontWeight: 600 }}>Design</span>,
                onClick: () => navigate('/design')
              },
              {
                key: 'synthesis',
                icon: renderSidebarIcon(<Microscope size={22} />),
                label: <span style={{ fontWeight: 600 }}>Synthesis</span>,
                onClick: () => navigate('/synthesis')
              },
              {
                key: 'documents',
                icon: renderSidebarIcon(<FileText size={22} />),
                label: <span style={{ fontWeight: 600 }}>Documents</span>,
                popupClassName: 'app-sidebar-popup-menu',
                children: [
                  {
                    key: 'patents',
                    label: 'Patents',
                    popupClassName: 'app-sidebar-popup-menu',
                    children: [
                      { key: 'patent-write', label: 'My 특허 쓰기', onClick: () => navigate('/patents/write') },
                      { key: 'patent-analysis', label: 'My 특허 분석', onClick: () => navigate('/patents/analysis') },
                      { key: 'patent-insight', label: 'Insight', onClick: () => navigate('/patents/insight') },
                      { key: 'patent-manage', label: 'My 특허 관리', onClick: () => navigate('/patents/manage') },
                    ]
                  },
                  {
                    key: 'papers',
                    label: 'Papers',
                    popupClassName: 'app-sidebar-popup-menu',
                    children: [
                      { key: 'paper-manage', label: 'My 논문 관리', onClick: () => navigate('/papers/manage') },
                    ]
                  },
                  { key: 'conferences', label: 'Conferences', onClick: () => navigate('/conferences') },
                ],
              },
              {
                key: 'compounds',
                icon: renderSidebarIcon(<BenzeneIcon size={22} />),
                label: <span style={{ fontWeight: 600 }}>Compounds</span>,
                popupClassName: 'app-sidebar-popup-menu',
                children: [
                  { key: 'compound-search', label: 'Search', onClick: () => navigate('/compounds/search') },
                  { key: 'chem-space', label: 'Chemical space', onClick: () => navigate('/chem-space') },
                  { key: 'clustering', label: 'Clustering', onClick: () => navigate('/clustering') },
                ],
              },
              {
                key: 'tools',
                icon: renderSidebarIcon(<FlaskConical size={22} />),
                label: <span style={{ fontWeight: 600 }}>Tools</span>,
                popupClassName: 'app-sidebar-popup-menu',
                children: [
                  { key: 'reaction-predictor', label: 'Reaction Site Predictor', onClick: () => navigate('/reaction-predictor') },
                ],
              },
              {
                key: 'universal-search',
                icon: renderSidebarIcon(<Search size={22} />),
                label: <span style={{ fontWeight: 600 }}>통합검색</span>,
                onClick: () => navigate('/universal-search')
              },
              ]}
            />
          )}
        </div>

        <div style={{ marginTop: 'auto', padding: '12px 8px 0', flexShrink: 0, display: sidebarMode === 'hidden' ? 'none' : 'block' }}>
          {sidebarMode === 'mini' ? (
            <div className="mini-menu-rail">
              {bottomMiniMenuItems.map((item) => (
                <Tooltip key={item.key} title={item.label} placement="right">
                  <Button
                    type="text"
                    aria-label={item.label}
                    style={miniMenuButtonStyle(isMiniItemSelected(item))}
                    onClick={item.onClick}
                  >
                    {item.icon}
                  </Button>
                </Tooltip>
              ))}
            </div>
          ) : (
            <Menu
              mode="inline"
              inlineIndent={8}
              selectedKeys={[getSelectedKey()]}
              style={{ background: 'transparent', borderRight: 0 }}
              items={[
              {
                key: 'development-status',
                icon: renderSidebarIcon(<Activity size={22} />),
                label: <span style={{ fontWeight: 600 }}>수리응용2팀 서비스 개발 진행 현황</span>,
                onClick: () => navigate('/development-status')
              },
              {
                key: 'contact',
                icon: renderSidebarIcon(<HelpCircle size={22} />),
                label: <span style={{ fontWeight: 600 }}>문의하기</span>,
                onClick: () => navigate('/contact')
              },
              ]}
            />
          )}
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
                    fontSize: '13px',
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
        .app-sidebar .ant-menu-item-selected { 
          background-color: ${isDarkMode ? '#2b2b2b' : '#ffffff'} !important; 
          color: #F87C63 !important; 
          border-radius: 10px !important;
          box-shadow: ${isDarkMode ? 'none' : '0 4px 6px -1px rgb(0 0 0 / 0.1)'} !important;
        }
        .app-sidebar .ant-menu-item { 
          border-radius: 10px !important; 
          margin-bottom: 2px !important; 
          height: 42px !important;
          line-height: 42px !important;
          display: flex !important;
          align-items: center !important;
        }
        .app-sidebar .ant-menu-inline .ant-menu-sub.ant-menu-inline { background: transparent !important; margin-left: 8px !important; }
        .app-sidebar .ant-menu-submenu-title {
          border-radius: 10px !important;
          height: 42px !important;
          line-height: 42px !important;
          margin-bottom: 2px !important;
          display: flex !important;
          align-items: center !important;
        }
        .app-sidebar .sidebar-menu-icon {
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          width: 22px !important;
          height: 22px !important;
          min-width: 22px !important;
          margin-inline-end: 0 !important;
          color: currentColor !important;
          opacity: 1 !important;
          visibility: visible !important;
        }
        .app-sidebar .sidebar-menu-icon svg {
          display: block !important;
          width: 22px !important;
          height: 22px !important;
          min-width: 22px !important;
          color: currentColor !important;
          stroke: currentColor !important;
        }
        .mini-menu-rail {
          width: 40px;
          margin: 0 auto;
          overflow: visible;
        }
        .mini-menu-rail .ant-btn {
          flex: 0 0 40px;
        }
        .mini-menu-rail .ant-btn svg {
          width: 22px;
          height: 22px;
          color: currentColor;
          stroke: currentColor;
        }
        .app-sidebar-popup-menu {
          z-index: 1200 !important;
          width: max-content !important;
          min-width: 200px !important;
        }
        .app-sidebar-popup-menu .ant-dropdown-menu,
        .app-sidebar-popup-menu .app-sidebar-dropdown-menu {
          width: max-content !important;
          min-width: 200px !important;
          overflow: visible !important;
        }
        .app-sidebar-popup-menu .ant-dropdown-menu-item,
        .app-sidebar-popup-menu .ant-dropdown-menu-submenu-title {
          width: auto !important;
          min-width: 200px !important;
          height: 40px !important;
          line-height: 40px !important;
          display: flex !important;
          align-items: center !important;
          padding-inline: 20px 16px !important;
          overflow: visible !important;
        }
        .app-sidebar-popup-menu .ant-dropdown-menu-title-content {
          display: inline-flex !important;
          flex: 1 0 max-content !important;
          width: auto !important;
          min-width: max-content !important;
          max-width: none !important;
          overflow: visible !important;
          text-overflow: clip !important;
          white-space: nowrap !important;
          opacity: 1 !important;
          visibility: visible !important;
        }
        .app-sidebar-popup-menu .mini-dropdown-label {
          display: inline-block !important;
          width: max-content !important;
          min-width: max-content !important;
          max-width: none !important;
          overflow: visible !important;
          text-overflow: clip !important;
          white-space: nowrap !important;
        }
        .app-sidebar-popup-menu .ant-dropdown-menu-submenu-expand-icon,
        .app-sidebar-popup-menu .ant-dropdown-menu-submenu-arrow {
          display: block !important;
          opacity: 1 !important;
          visibility: visible !important;
        }
        .app-sidebar-popup-menu .mini-menu-popup-title {
          color: ${isDarkMode ? '#cfcfcf' : '#4b5563'} !important;
          cursor: default !important;
          font-weight: 700 !important;
          opacity: 1 !important;
        }
        .app-sidebar-popup-menu .mini-menu-popup-title .ant-menu-title-content {
          font-weight: 700 !important;
        }
        .app-sidebar-popup-menu .mini-menu-popup-title .ant-dropdown-menu-title-content {
          font-weight: 700 !important;
        }
        .vora-link-button {
          background: ${isDarkMode ? '#302747' : '#f3efff'} !important;
          border-color: ${isDarkMode ? '#5b4788' : '#d8ccff'} !important;
          color: ${isDarkMode ? '#d8ccff' : '#6f45c9'} !important;
        }
        .vora-link-button:hover,
        .vora-link-button:focus {
          background: ${isDarkMode ? '#3a2f55' : '#ebe3ff'} !important;
          border-color: ${isDarkMode ? '#7560a8' : '#c8b6ff'} !important;
          color: ${isDarkMode ? '#eee7ff' : '#5e35b1'} !important;
        }
        .medichem-eln-link-button {
          background: ${isDarkMode ? '#3a271f' : '#fff1e8'} !important;
          border-color: ${isDarkMode ? '#8a5a3c' : '#ffd3ba'} !important;
          color: ${isDarkMode ? '#ffd5bd' : '#c45a1c'} !important;
        }
        .medichem-eln-link-button:hover,
        .medichem-eln-link-button:focus {
          background: ${isDarkMode ? '#4a3328' : '#ffe8d8'} !important;
          border-color: ${isDarkMode ? '#a66f4a' : '#ffc19e'} !important;
          color: ${isDarkMode ? '#ffe6d8' : '#a94712'} !important;
        }
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
