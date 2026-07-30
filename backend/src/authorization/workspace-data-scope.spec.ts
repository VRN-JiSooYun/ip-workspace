import { WorkspaceAuthorizationService } from './workspace-authorization.service';
import type { WorkspaceAccessContext } from './workspace-authorization.service';

const context = (
  overrides: Partial<WorkspaceAccessContext> = {},
): WorkspaceAccessContext => ({
  userId: 'user-1',
  globalRoles: [],
  organization: { id: 'org-1', name: 'Workspace' },
  teams: [{ id: 'team-1', name: 'Research' }],
  permissions: ['conference.read', 'patentAnalysis.read', 'design.read'],
  modules: {
    conference: { read: true, write: false, manage: false },
    patentAnalysis: { read: true, write: false, manage: false },
    sarTable: { read: false, write: false, manage: false },
    design: { read: true, write: false, manage: false },
    synthesis: { read: false, write: false, manage: false },
  },
  ...overrides,
});

describe('workspace data scope', () => {
  const service = new WorkspaceAuthorizationService(null as never, null as never);

  it('grants global scope only to a super admin', () => {
    expect(service.resolveDataScope(
      context({ globalRoles: ['SUPER_ADMIN'] }),
      'conference',
    )).toEqual({ type: 'GLOBAL' });
  });

  it('keeps conference catalog access in the current organization', () => {
    expect(service.resolveDataScope(context(), 'conference')).toEqual({
      type: 'ORG',
      organizationId: 'org-1',
    });
  });

  it('keeps regular patent helper access owned by the signed-in user', () => {
    expect(service.resolveDataScope(context(), 'patentAnalysis')).toEqual({
      type: 'OWN',
      userId: 'user-1',
    });
  });

  it('uses all current team memberships for team-owned domains', () => {
    expect(service.resolveDataScope(context(), 'design')).toEqual({
      type: 'TEAM',
      organizationId: 'org-1',
      teamIds: ['team-1'],
    });
  });
});
