import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { WorkspaceAccessContext } from './workspace-authorization.service';
import type { WorkspaceScopedRequest } from './workspace-data-scope';

export const WorkspaceAccess = createParamDecorator(
  (_data: unknown, context: ExecutionContext): WorkspaceAccessContext => {
    const request = context.switchToHttp().getRequest<WorkspaceScopedRequest>();
    if (!request.workspaceAccessContext) {
      throw new Error('WORKSPACE_ACCESS_CONTEXT_NOT_RESOLVED');
    }
    return request.workspaceAccessContext as WorkspaceAccessContext;
  },
);
