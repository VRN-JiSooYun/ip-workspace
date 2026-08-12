import type {
  WorkspaceAccessContext,
  WorkspacePermission,
} from './accessContextApi';
import type { AuthSession } from './authApi';

/**
 * 백엔드 없이 UI만 확인하기 위한 로컬 전용 인증 우회.
 *
 * `.env.local`에 `VITE_AUTH_BYPASS=true`를 넣었을 때만 켜진다. `.env.local`은
 * gitignore 대상이고 플래그 기본값이 꺼짐이라, 값을 넣지 않은 환경에서는
 * 아무 영향이 없다. 실제 groupware 연동을 테스트할 때는 플래그를 지운다.
 */
export const AUTH_BYPASS = import.meta.env.VITE_AUTH_BYPASS === 'true';

const ALL_PERMISSIONS: WorkspacePermission[] = [
  'userAccess.manage',
  'patentAnalysis.read',
  'patentAnalysis.manage',
  'sarTable.read',
  'sarTable.write',
  'sarTable.manage',
  'design.read',
  'design.write',
  'design.manage',
  'synthesis.read',
  'synthesis.write',
  'synthesis.manage',
];

const fullCapability = { read: true, write: true, manage: true };

export const bypassSession = (): AuthSession => ({
  user: {
    id: 'bypass-user',
    email: 'test@voronoi.io',
    name: 'Test User',
    team: 'Test Team',
    fullname: 'Test User',
    role: 'SUPER_ADMIN',
    status: 'ACTIVE',
  },
  session: {
    id: 'bypass-session',
    expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
  },
});

export const bypassAccessContext = (): WorkspaceAccessContext => ({
  userId: 'bypass-user',
  globalRoles: ['SUPER_ADMIN'],
  organization: { id: 'bypass-org', name: 'Test Organization' },
  teams: [{ id: 'bypass-team', name: 'Test Team' }],
  permissions: ALL_PERMISSIONS,
  modules: {
    patentAnalysis: fullCapability,
    sarTable: fullCapability,
    design: fullCapability,
    synthesis: fullCapability,
  },
});
