import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Button, theme, Input, Avatar, Space, Dropdown, Tooltip } from 'antd';
import type { MenuProps } from 'antd';
import { useTheme } from '../../contexts/ThemeContext';
import {
  Search,
  Bell,
  Moon,
  Sun,
  Palette,
  Menu as MenuIcon,
  PanelLeftClose,
} from 'lucide-react';
import RdkitDrawOptionsModal from '../common/RdkitDrawOptionsModal';
import RightSidebar from './RightSidebar';
import { withBasePath } from '../../config/basePath';
import { useAuthSession } from '../../contexts/AuthSessionContext';
import { useAccessContext } from '../../contexts/AccessContext';
import {
  BOTTOM_NAV,
  MAIN_NAV,
  filterNavByPermission,
  getAncestorKeys,
  getSubtreeKeys,
  resolveSelectedKey,
  type NavNode,
} from './navigation';

const { Header, Sider, Content } = Layout;

interface MainLayoutProps {
  children: React.ReactNode;
}

import { useUIStore } from '../../store/useUIStore';

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const [sidebarMode, setSidebarMode] = useState<'full' | 'mini' | 'hidden'>('full');
  const [isRdkitDrawOptionsOpen, setIsRdkitDrawOptionsOpen] = useState(false);
  const [viewportWidth, setViewportWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return 1920;
    return window.innerWidth;
  });
  const { token } = theme.useToken();
  const { isDarkMode, toggleTheme } = useTheme();
  const { headerContent } = useUIStore();
  const session = useAuthSession();
  const { hasPermission } = useAccessContext();
  const navigate = useNavigate();
  const location = useLocation();
  const isStackedHeader = viewportWidth <= 900;
  const headerHeight = isStackedHeader ? 128 : 80;
  const voraExternalUrl = 'https://voronoi.app/vora/';
  const userDisplayName = session.user.fullname?.trim()
    || session.user.name?.trim()
    || session.user.email;

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

  const mainNav = React.useMemo(
    () => filterNavByPermission(MAIN_NAV, hasPermission),
    [hasPermission],
  );
  const bottomNav = React.useMemo(
    () => filterNavByPermission(BOTTOM_NAV, hasPermission),
    [hasPermission],
  );

  /** Expanded sidebar: top-level entries carry an icon and bold label. */
  const toFullMenuItems = (nodes: NavNode[], depth = 0): MenuProps['items'] =>
    nodes.map((node) => ({
      key: node.key,
      ...(node.icon ? { icon: renderSidebarIcon(node.icon) } : {}),
      label: depth === 0 ? <span style={{ fontWeight: 600 }}>{node.label}</span> : node.label,
      ...(node.children
        ? {
          popupClassName: 'app-sidebar-popup-menu',
          children: toFullMenuItems(node.children, depth + 1),
        }
        : { onClick: () => navigate(node.path!) }),
    }));

  /** Mini rail: children surface in a hover dropdown instead. */
  const toMiniDropdownItems = (nodes: NavNode[]): MenuProps['items'] =>
    nodes.map((node) => ({
      key: node.key,
      label: renderMiniDropdownLabel(node.label),
      title: '',
      ...(node.children
        ? {
          popupClassName: 'app-sidebar-popup-menu',
          children: toMiniDropdownItems(node.children),
        }
        : { onClick: () => navigate(node.path!) }),
    }));

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
    color: selected ? 'var(--brand-primary)' : token.colorText,
    background: selected ? (isDarkMode ? '#2b2b2b' : '#ffffff') : 'transparent',
    boxShadow: selected && !isDarkMode ? '0 4px 6px -1px rgb(0 0 0 / 0.1)' : 'none',
  });

  const selectedKey = resolveSelectedKey(location.pathname, [...MAIN_NAV, ...BOTTOM_NAV]);

  const isNavNodeSelected = (node: NavNode) => getSubtreeKeys(node).includes(selectedKey);

  const getMiniDropdownMenu = (node: NavNode): MenuProps => ({
    className: 'app-sidebar-dropdown-menu',
    style: { minWidth: 200 },
    items: [
      {
        key: `${node.key}-title`,
        label: renderMiniDropdownLabel(node.label),
        title: '',
        disabled: true,
        className: 'mini-menu-popup-title',
      },
      { type: 'divider' },
      ...(toMiniDropdownItems(node.children ?? []) ?? []),
    ],
  });

  const renderMiniRail = (nodes: NavNode[]) => (
    <div className="mini-menu-rail">
      {nodes.map((node) => {
        const button = (
          <Button
            key={node.key}
            type="text"
            aria-label={node.label}
            style={miniMenuButtonStyle(isNavNodeSelected(node))}
            onClick={node.children ? undefined : () => navigate(node.path!)}
          >
            {node.icon}
          </Button>
        );

        if (!node.children) {
          return (
            <Tooltip key={node.key} title={node.label} placement="right">
              {button}
            </Tooltip>
          );
        }

        return (
          <Dropdown
            key={node.key}
            menu={getMiniDropdownMenu(node)}
            placement="topLeft"
            trigger={['hover']}
            overlayClassName="app-sidebar-popup-menu"
          >
            {button}
          </Dropdown>
        );
      })}
    </div>
  );


  const [openMenuKeys, setOpenMenuKeys] = useState<string[]>(() => (
    getAncestorKeys(selectedKey, MAIN_NAV)
  ));

  React.useEffect(() => {
    const ancestorKeys = getAncestorKeys(selectedKey, MAIN_NAV);
    if (ancestorKeys.length === 0) return;
    setOpenMenuKeys((currentKeys) => (
      Array.from(new Set([...currentKeys, ...ancestorKeys]))
    ));
  }, [location.pathname, selectedKey]);

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
        <div
          className={`app-sidebar-brand app-sidebar-brand-${sidebarMode}`}
          onClick={() => navigate('/dashboard')}
        >
          {sidebarMode === 'full' ? (
            <>
              <div className="app-sidebar-mini-logo">
                <img
                  className="app-sidebar-mini-logo-image"
                  src={withBasePath("sidebar-mini-logo.svg")}
                  alt="IP Workspace"
                />
              </div>
              <div className="app-sidebar-wordmark" aria-label="IP Workspace">
                <div className="app-sidebar-wordmark-brand">IP</div>
                <div className="app-sidebar-wordmark-workspace">Workspace</div>
              </div>
            </>
          ) : (
            <div className="app-sidebar-mini-logo">
              <img
                className="app-sidebar-mini-logo-image"
                src={withBasePath("sidebar-mini-logo.svg")}
                alt="IP Workspace"
              />
            </div>
          )}
        </div>

        <div
          className={`app-sidebar-scroll-area app-sidebar-scroll-area-${sidebarMode}`}
          style={{ overflowY: 'auto', flex: '1 1 auto', minHeight: 0, padding: sidebarMode === 'full' ? '0 8px' : '0 4px', display: sidebarMode === 'hidden' ? 'none' : 'block' }}
        >
          {/* <Tooltip title={sidebarMode === 'mini' ? 'VORA' : ''} placement="right">
            <Button
              className="vora-link-button"
              onClick={() => window.open(voraExternalUrl, '_blank', 'noopener,noreferrer')}
              style={{
                height: 34,
                width: sidebarMode === 'full' ? '100%' : 34,
                marginLeft: 'auto',
                marginRight: 'auto',
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
          <Tooltip title={sidebarMode === 'mini' ? 'IP ELN' : ''} placement="right">
            <Button
              className="eln-link-button"
              style={{
                height: 34,
                width: sidebarMode === 'full' ? '100%' : 34,
                marginLeft: 'auto',
                marginRight: 'auto',
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
              {sidebarMode === 'full' ? 'IP ELN' : 'M'}
            </Button>
          </Tooltip> */}
          <div
            style={{
              height: 1,
              margin: sidebarMode === 'full' ? '0 4px 14px 12px' : '0 8px 14px',
              background: isDarkMode ? '#303030' : '#d8dbe0',
            }}
          />
          {sidebarMode === 'mini' ? (
            renderMiniRail(mainNav)
          ) : (
            <Menu
              mode="inline"
              inlineIndent={8}
              selectedKeys={[selectedKey]}
              openKeys={openMenuKeys}
              onOpenChange={(keys) => setOpenMenuKeys(keys)}
              style={{ background: 'transparent', borderRight: 0 }}
              items={toFullMenuItems(mainNav)}
            />
          )}
        </div>

        <div style={{ marginTop: 'auto', padding: '12px 8px 0', flexShrink: 0, display: sidebarMode === 'hidden' ? 'none' : 'block' }}>
          {sidebarMode === 'mini' ? (
            renderMiniRail(bottomNav)
          ) : (
            <Menu
              mode="inline"
              inlineIndent={8}
              selectedKeys={[selectedKey]}
              style={{ background: 'transparent', borderRight: 0 }}
              items={toFullMenuItems(bottomNav)}
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
          lineHeight: 'normal',
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

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: isStackedHeader ? 'flex-end' : 'flex-start', gap: isStackedHeader ? 12 : 24, flexShrink: 0, width: isStackedHeader ? '100%' : undefined, minWidth: 0, height: 40 }}>
            <Space align="center" size={isStackedHeader ? 8 : 16} style={{ height: 40, lineHeight: 1 }}>
              <Button
                type="text"
                icon={<Bell size={20} color={token.colorTextSecondary} />}
                style={{ width: 40, height: 40, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
              />
              <Button type="text" onClick={toggleTheme} style={{ width: 40, height: 40, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} icon={
                isDarkMode ? <Sun size={20} color={token.colorTextSecondary} /> : <Moon size={20} color={token.colorTextSecondary} />
              } />
            </Space>
            <span
              title={userDisplayName}
              style={{
                maxWidth: isStackedHeader ? 200 : 280,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                color: token.colorText,
                height: 40,
                display: 'inline-flex',
                alignItems: 'center',
                lineHeight: '20px',
                fontSize: 15,
                fontWeight: 600,
              }}
            >
              {userDisplayName}
            </span>
            <Avatar
              size={40}
              style={{ border: '2px solid #fff', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', background: token.colorPrimary }}
            >
              {userDisplayName.charAt(0).toUpperCase() || '?'}
            </Avatar>
          </div>
        </Header>
        <Content style={{
          padding: '0 12px 16px 12px',
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

      {/* 우측 상시 레일. 좌측 Sider와 대칭으로 root Layout의 형제이므로 화면 높이 전체를
          쓰고, 화면(children)이 바뀌어도 그대로 남는다 — 그게 이 컴포넌트의 목적이다. */}
      <RightSidebar />

      <RdkitDrawOptionsModal
        open={isRdkitDrawOptionsOpen}
        onCancel={() => setIsRdkitDrawOptionsOpen(false)}
      />
      <style>{`
        .app-sidebar .ant-menu-item-selected { 
          background-color: ${isDarkMode ? '#2b2b2b' : '#ffffff'} !important; 
          color: var(--brand-primary) !important; 
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
        .eln-link-button {
          background: ${isDarkMode ? '#3a271f' : '#fff1e8'} !important;
          border-color: ${isDarkMode ? '#8a5a3c' : '#ffd3ba'} !important;
          color: ${isDarkMode ? '#ffd5bd' : '#c45a1c'} !important;
        }
        .eln-link-button:hover,
        .eln-link-button:focus {
          background: ${isDarkMode ? '#4a3328' : '#ffe8d8'} !important;
          border-color: ${isDarkMode ? '#a66f4a' : '#ffc19e'} !important;
          color: ${isDarkMode ? '#ffe6d8' : '#a94712'} !important;
        }
        .app-sidebar-brand {
          display: flex;
          align-items: center;
          min-height: 40px;
          margin-bottom: 28px;
          opacity: ${sidebarMode === 'hidden' ? 0 : 1};
          cursor: pointer;
          transition: opacity 0.2s;
        }
        .app-sidebar-brand-full {
          justify-content: flex-start;
          padding: 0 12px;
          gap: 10px;
        }
        .app-sidebar-brand-mini {
          justify-content: center;
          padding: 0;
        }
        .app-sidebar-brand-hidden {
          display: none;
        }
        .app-sidebar-wordmark {
          display: flex;
          flex-direction: column;
          justify-content: center;
          min-width: 0;
          line-height: 1;
        }
        .app-sidebar-wordmark-brand {
          color: var(--brand-primary) !important; 
          font-size: 14px;
          font-weight: 800;
          letter-spacing: 0;
        }
        .app-sidebar-wordmark-workspace {
          margin-top: 0.6px;
          color: ${isDarkMode ? '#e6e8eb' : '#191c1e'};
          font-size: 22px;
          font-weight: 800;
          letter-spacing: 0;
        }
        .app-sidebar-mini-logo {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          flex-shrink: 0;
          color: #fff;
          background: ${isDarkMode ? '#24272b' : '#ffffff'};
          border: 1px solid ${isDarkMode ? '#3b4148' : '#d8dee6'};
          border-radius: 12px;
          overflow: hidden;
        }
        .app-sidebar-mini-logo-image {
          display: block;
          width: 34px;
          height: 34px;
          object-fit: contain;
          image-rendering: auto;
        }
        .cursor-pointer { cursor: pointer; }
        .app-sidebar .ant-layout-sider-children {
          height: 100%;
          min-height: 0;
          display: flex;
          flex-direction: column;
        }
        .app-sidebar-scroll-area {
          scrollbar-width: thin;
          scrollbar-color: ${isDarkMode ? '#4b5563 transparent' : '#c4cbd3 transparent'};
        }
        .app-sidebar-scroll-area-full .vora-link-button,
        .app-sidebar-scroll-area-full .eln-link-button {
          width: calc(100% - 24px) !important;
          margin-left: 12px !important;
          margin-right: 0 !important;
        }
        .app-sidebar-scroll-area-mini .vora-link-button,
        .app-sidebar-scroll-area-mini .eln-link-button {
          width: 34px !important;
          min-width: 34px !important;
          margin-left: auto !important;
          margin-right: auto !important;
        }
        .app-sidebar-scroll-area::-webkit-scrollbar {
          width: 10px;
        }
        .app-sidebar-scroll-area::-webkit-scrollbar-track {
          background: transparent;
        }
        .app-sidebar-scroll-area::-webkit-scrollbar-thumb {
          background: ${isDarkMode ? '#4b5563' : '#c4cbd3'};
          border: 2px solid ${isDarkMode ? '#1a1a1a' : '#f2f4f6'};
          border-radius: 999px;
        }
        .app-sidebar-scroll-area::-webkit-scrollbar-thumb:hover {
          background: ${isDarkMode ? '#6b7280' : '#9aa3aa'};
        }
        .app-sidebar-scroll-area::-webkit-scrollbar-corner {
          background: transparent;
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
