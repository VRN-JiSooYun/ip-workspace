import React from 'react';
import {
  BarChart3,
  FileText,
  FolderKanban,
  HelpCircle,
  LayoutDashboard,
  ListChecks,
  Presentation,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { getRoutePermission } from '../../routes';
import type { WorkspacePermission } from '../../services/accessContextApi';

/**
 * The single source of truth for sidebar navigation.
 *
 * Everything the sidebar needs is derived from this tree rather than written
 * out per view:
 *
 *  - the full (expanded) antd `Menu` items
 *  - the mini rail buttons and their hover dropdowns
 *  - `selectedKey` for the current URL
 *  - which parent keys must be open, and which keys count as "active" for a
 *    collapsed parent
 *
 * Previously each of those was hand-maintained separately, so adding one menu
 * entry meant editing five places and the encodings drifted apart.
 *
 * Permissions are NOT declared here. A node that points at a `path` inherits
 * whatever that route requires (see `getRoutePermission` in src/routes), so a
 * menu entry can never linger for a page the user cannot open. `permission`
 * below is only for gating a group that has no route of its own.
 */
export type NavNode = {
  key: string;
  label: string;
  /** Top-level nodes only; children render without icons. */
  icon?: React.ReactNode;
  /** Navigation target. Nodes with children act as groups and omit this. */
  path?: string;
  /** Extra exact paths that should also select this node. */
  altPaths?: string[];
  /** Path prefixes that select this node, e.g. detail routes with an id. */
  pathPrefixes?: string[];
  /**
   * Extra gate for group nodes that have no route to inherit from. Nodes with
   * a `path` should leave this unset and let the route decide.
   */
  permission?: WorkspacePermission;
  children?: NavNode[];
};

export const MAIN_NAV: NavNode[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    icon: <LayoutDashboard size={22} />,
    path: '/dashboard',
  },
  {
    key: 'patent-management',
    label: '특허 관리',
    icon: <FolderKanban size={22} />,
    path: '/patent-management',
  },
  {
    key: 'analysis',
    label: '분석',
    icon: <BarChart3 size={22} />,
    children: [
      {
        key: 'office-actions',
        label: '의견제출통지서',
        path: '/analysis/office-actions',
      },
    ],
  },
  // {
  //   key: 'documents',
  //   label: 'Documents',
  //   icon: <FileText size={22} />,
  //   children: [
  //     {
  //       key: 'patents',
  //       label: 'Patents',
  //       children: [
  //         { key: 'patent-write', label: 'My 특허 쓰기', path: '/patents/write' },
  //         {
  //           key: 'patent-analysis',
  //           label: 'My 특허 분석',
  //           path: '/patents/analysis',
  //           pathPrefixes: ['/patents/analysis/'],
  //         },
  //         { key: 'patent-insight', label: 'Insight', path: '/patents/insight' },
  //         { key: 'patent-manage', label: 'My 특허 관리', path: '/patents/manage' },
  //       ],
  //     },
  //     {
  //       key: 'papers',
  //       label: 'Papers',
  //       children: [
  //         { key: 'paper-manage', label: 'My 논문 관리', path: '/papers/manage' },
  //       ],
  //     },
  //   ],
  // },
  // {
  //   key: 'universal-search',
  //   label: '통합검색',
  //   icon: <Search size={22} />,
  //   path: '/universal-search',
  // },
];

export const BOTTOM_NAV: NavNode[] = [
  {
    key: 'access-registry',
    label: '사용자 접근 관리',
    icon: <ShieldCheck size={22} />,
    path: '/workspace/access-registry',
  },
  // {
  //   key: 'patent-analysis-admin',
  //   label: '특허 분석 관리',
  //   icon: <FileText size={22} />,
  //   path: '/workspace/patent-analysis-admin',
  // },
  {
    key: 'patent-code-admin',
    label: '특허 코드 관리',
    icon: <ListChecks size={22} />,
    path: '/workspace/patent-code-admin',
  },
  { key: 'contact', label: '문의하기', icon: <HelpCircle size={22} />, path: '/contact' },
];

/** Key selected when the current URL matches nothing in the tree. */
export const FALLBACK_NAV_KEY = 'patent-management';

/**
 * Drops nodes the user lacks permission for, then drops any group left with no
 * visible children — so a section never renders as an empty parent.
 *
 * Every gate must pass: the node's own `permission` (groups) and the permission
 * its route requires (leaves).
 */
export const filterNavByPermission = (
  nodes: NavNode[],
  hasPermission: (permission: WorkspacePermission) => boolean,
): NavNode[] =>
  nodes.reduce<NavNode[]>((visible, node) => {
    if (node.permission && !hasPermission(node.permission)) return visible;

    const routePermission = node.path ? getRoutePermission(node.path) : undefined;
    if (routePermission && !hasPermission(routePermission)) return visible;

    if (!node.children) {
      visible.push(node);
      return visible;
    }

    const children = filterNavByPermission(node.children, hasPermission);
    if (children.length > 0) visible.push({ ...node, children });
    return visible;
  }, []);

const walk = (nodes: NavNode[], visit: (node: NavNode, ancestors: NavNode[]) => void): void => {
  const recurse = (current: NavNode[], ancestors: NavNode[]) => {
    for (const node of current) {
      visit(node, ancestors);
      if (node.children) recurse(node.children, [...ancestors, node]);
    }
  };
  recurse(nodes, []);
};

/**
 * Resolves a URL to a nav key. Exact matches win; otherwise the longest
 * matching prefix does, so `/patents/analysis/123` picks the analysis entry
 * rather than something shorter that happens to share a stem.
 */
export const resolveSelectedKey = (pathname: string, nodes: NavNode[]): string => {
  const exactMatches: string[] = [];
  const prefixMatches: Array<{ key: string; length: number }> = [];

  walk(nodes, (node) => {
    const exactPaths = [node.path, ...(node.altPaths ?? [])].filter(Boolean) as string[];
    if (exactPaths.includes(pathname)) exactMatches.push(node.key);

    for (const prefix of node.pathPrefixes ?? []) {
      if (pathname.startsWith(prefix)) prefixMatches.push({ key: node.key, length: prefix.length });
    }
  });

  if (exactMatches.length > 0) return exactMatches[0];

  const longestPrefix = prefixMatches.sort((a, b) => b.length - a.length)[0];
  return longestPrefix?.key ?? FALLBACK_NAV_KEY;
};

/** Parent keys that must be open for `key` to be visible in the full menu. */
export const getAncestorKeys = (key: string, nodes: NavNode[]): string[] => {
  let found: string[] = [];
  walk(nodes, (node, ancestors) => {
    if (node.key === key) found = ancestors.map((ancestor) => ancestor.key);
  });
  return found;
};

/**
 * A node's own key plus every descendant key — what marks a collapsed parent
 * as active in the mini rail.
 */
export const getSubtreeKeys = (node: NavNode): string[] => {
  const keys = [node.key];
  walk(node.children ?? [], (child) => keys.push(child.key));
  return keys;
};
