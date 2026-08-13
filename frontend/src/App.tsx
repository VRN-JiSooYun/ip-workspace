import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { App as AntApp, ConfigProvider, theme } from 'antd';
import { useTheme } from './contexts/ThemeContext';
import { brandAlpha, useBrandPrimary } from './theme/brandColor';
import BrandColorDevPanel from './theme/BrandColorDevPanel';
import MainLayout from './components/layout/MainLayout';
import AuthGate from './components/auth/AuthGate';
import RequirePermission from './components/auth/RequirePermission';
import { APP_ROUTES } from './routes';
import { ROUTER_BASENAME } from './config/basePath';

const App: React.FC = () => {
  const { isDarkMode } = useTheme();
  // antd parses this hex to derive its own palette, so it needs a literal
  // value rather than var(--brand-primary).
  const brandPrimary = useBrandPrimary();

  return (
    <ConfigProvider
      theme={{
        algorithm: isDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: brandPrimary,
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
            rowHoverBg: isDarkMode ? brandAlpha(0.18) : brandAlpha(0.12),
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
            itemSelectedColor: brandPrimary,
            itemHoverBg: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
          },
          Button: {
            borderRadius: 12,
            controlHeight: 40,
          }
        },
      }}
    >
      <Router
        basename={ROUTER_BASENAME}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <AntApp>
          <AuthGate>
            <MainLayout>
            <Routes>
              {APP_ROUTES.map((route) => (
                <Route
                  key={route.path}
                  path={route.path}
                  element={
                    route.redirectTo
                      ? <Navigate to={route.redirectTo} replace />
                      : route.permission
                        ? (
                          <RequirePermission permission={route.permission}>
                            {route.element}
                          </RequirePermission>
                        )
                        : route.element
                  }
                />
              ))}
            </Routes>
            </MainLayout>
          </AuthGate>
          {/* Static false in production, so Rollup drops the panel entirely. */}
          {import.meta.env.DEV && <BrandColorDevPanel />}
        </AntApp>
      </Router>
    </ConfigProvider>
  );
};

export default App;
