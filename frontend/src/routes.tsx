import React from 'react';
import AccessRegistry from './pages/AccessRegistry';
import ConferenceAbstractDetail from './pages/ConferenceAbstractDetail';
import ConferenceAdmin from './pages/ConferenceAdmin';
import ConferenceList from './pages/ConferenceList';
import Contact from './pages/Contact';
import Dashboard from './pages/Dashboard';
import EmptyPage from './pages/EmptyPage';
import PatentAnalysisAdmin from './pages/PatentAnalysisAdmin';
import PatentAnalysisDetail from './pages/PatentAnalysisDetail';
import PatentAnalysisList from './pages/PatentAnalysisList';
import PatentInsight from './pages/PatentInsight';
import PatentManagement from './pages/PatentManagement';
import UniversalSearch from './pages/UniversalSearch';
import type { WorkspacePermission } from './services/accessContextApi';

/**
 * The single source of truth for routing and per-page authorization.
 *
 * `App` renders every entry here, wrapping it in `RequirePermission` when
 * `permission` is set, and the sidebar manifest (`components/layout/navigation`)
 * looks its menu-entry permissions up from this table via `getRoutePermission`.
 *
 * That direction matters: a permission is a property of the *page*, and the
 * menu entry pointing at it inherits that. So a menu item can never stay
 * visible for a route the user cannot open — the two cannot drift apart, and
 * gating a page is a one-line change here.
 */
export type AppRoute = {
  path: string;
  /** Rendered element. Omit when `redirectTo` is set. */
  element?: React.ReactNode;
  /** Renders a redirect to this path instead of an element. */
  redirectTo?: string;
  /** When set, the route is wrapped in `RequirePermission`. */
  permission?: WorkspacePermission;
};

export const APP_ROUTES: AppRoute[] = [
  { path: '/', redirectTo: '/dashboard' },

  // ---- Documents ---------------------------------------------------------
  {
    path: '/patents/write',
    permission: 'patentAnalysis.read',
    element: (
      <EmptyPage
        title="My 특허 쓰기"
        breadcrumb={[{ label: 'Documents' }, { label: 'Patents' }, { label: 'My 특허 쓰기' }]}
      />
    ),
  },
  { path: '/patents/analysis', permission: 'patentAnalysis.read', element: <PatentAnalysisList /> },
  { path: '/patents/analysis/:id', permission: 'patentAnalysis.read', element: <PatentAnalysisDetail /> },
  { path: '/patents/insight', permission: 'patentAnalysis.read', element: <PatentInsight /> },
  {
    path: '/patents/manage',
    permission: 'patentAnalysis.read',
    element: (
      <EmptyPage
        title="My 특허 관리"
        breadcrumb={[{ label: 'Documents' }, { label: 'Patents' }, { label: 'My 특허 관리' }]}
      />
    ),
  },
  {
    path: '/papers/manage',
    element: (
      <EmptyPage
        title="My 논문 관리"
        breadcrumb={[{ label: 'Documents' }, { label: 'Papers' }, { label: 'My 논문 관리' }]}
      />
    ),
  },

  // ---- 특허 관리 -----------------------------------------------------------
  { path: '/patent-management', permission: 'patentAnalysis.read', element: <PatentManagement /> },

  // Need to Create IP Dashboard
  { path: '/dashboard', element: <Dashboard /> },

  // ---- Conference --------------------------------------------------------
  { path: '/conferences', permission: 'conference.read', element: <ConferenceList /> },
  {
    path: '/conferences/abstracts/:abstractId',
    permission: 'conference.read',
    element: <ConferenceAbstractDetail />,
  },


  { path: '/universal-search', element: <UniversalSearch /> },

  // ---- Workspace administration ------------------------------------------
  { path: '/workspace/access-registry', permission: 'userAccess.manage', element: <AccessRegistry /> },
  { path: '/workspace/conference-admin', permission: 'conference.manage', element: <ConferenceAdmin /> },
  {
    path: '/workspace/patent-analysis-admin',
    permission: 'patentAnalysis.manage',
    element: <PatentAnalysisAdmin />,
  },

  { path: '/contact', element: <Contact /> },
  { path: '*', redirectTo: '/dashboard' },
];

const permissionByPath = new Map<string, WorkspacePermission>(
  APP_ROUTES.flatMap((route) => (route.permission ? [[route.path, route.permission]] : [])),
);

/** The permission required to open `path`, or undefined if it is unrestricted. */
export const getRoutePermission = (path: string): WorkspacePermission | undefined =>
  permissionByPath.get(path);
