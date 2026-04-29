import React, { useState } from 'react';
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
  ChevronLeft,
  ChevronRight,
  FileText,
  BookOpen,
  Users as UsersIcon
} from 'lucide-react';

const { Header, Sider, Content } = Layout;

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const { token } = theme.useToken();
  const { isDarkMode, toggleTheme } = useTheme();

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        theme={isDarkMode ? 'dark' : 'light'}
        width={280}
        style={{
          background: isDarkMode ? '#1a1a1a' : '#f2f4f6',
          padding: collapsed ? '24px 8px' : '32px 16px',
          borderRight: isDarkMode ? '1px solid #303030' : 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '0 16px', marginBottom: 40, position: 'relative' }}>
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
          }}>
            <FlaskConical size={24} />
          </div>
          {!collapsed && (
            <div>
              <div style={{ fontWeight: 800, fontSize: '18px', color: isDarkMode ? '#e8e8e8' : '#191c1e', letterSpacing: '-0.5px' }}>MyWorkspace</div>
            </div>
          )}

          {/* Sider Toggle Button - Floating at the edge */}
          <Button
            type="text"
            icon={collapsed ? <ChevronRight size={16} color="#fff" /> : <ChevronLeft size={16} color="#fff" />}
            onClick={() => setCollapsed(!collapsed)}
            style={{
              position: 'absolute',
              right: collapsed ? -20 : -28,
              top: 40,
              width: 24,
              height: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#F87C63',
              borderRadius: '50%',
              border: isDarkMode ? '2px solid #1a1a1a' : '2px solid #fff',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              zIndex: 100,
              padding: 0
            }}
          />
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: '0 8px' }}>
          <Menu
            mode="inline"
            defaultSelectedKeys={['dashboard']}
            style={{ background: 'transparent', borderRight: 0 }}
            items={[
              {
                key: 'dashboard',
                icon: <LayoutDashboard size={20} />,
                label: <span style={{ fontWeight: 600 }}>Dashboard</span>,
              },
              {
                key: 'compounds',
                icon: <Beaker size={20} />,
                label: <span style={{ fontWeight: 600 }}>Compounds</span>,
                children: [
                  { key: 'myboard', label: 'My board' },
                  { key: 'my-tree', label: 'My tree' },
                ],
              },
              {
                key: 'documents',
                icon: <FileText size={20} />,
                label: <span style={{ fontWeight: 600 }}>Documents</span>,
                children: [
                  {
                    key: 'patents',
                    label: 'Patents',
                    children: [
                      { key: 'patent-write', label: 'My 특허 쓰기' },
                      { key: 'patent-analysis', label: 'My 특허 분석' },
                      { key: 'patent-manage', label: 'My 특허 관리' },
                    ]
                  },
                  {
                    key: 'papers',
                    label: 'Papers',
                    children: [
                      { key: 'paper-manage', label: 'My 논문 관리' },
                    ]
                  },
                  { key: 'conferences', label: 'Conferences' },
                ],
              },
              {
                key: 'pdbs',
                icon: <Activity size={20} />,
                label: <span style={{ fontWeight: 600 }}>PDBs</span>,
              },
              {
                key: 'universal-search',
                icon: <Search size={20} />,
                label: <span style={{ fontWeight: 600 }}>통합검색</span>,
              },
            ]}
            onClick={({ key }) => {
              (window as any).onNavigate?.(key);
            }}
          />
        </div>
      </Sider>

      <Layout>
        <Header style={{
          padding: '0 48px',
          background: token.colorBgLayout,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 80,
          borderBottom: 'none'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
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
          padding: '0 48px 48px 48px',
          overflow: 'auto',
          minHeight: 'calc(100vh - 80px)',
          backgroundColor: token.colorBgLayout
        }}>
          {children}
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
      `}</style>
    </Layout>
  );
};

export default MainLayout;
