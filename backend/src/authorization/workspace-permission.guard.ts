import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import {
  WORKSPACE_PERMISSIONS_METADATA,
  type RequiredPermissions,
} from "./require-permissions.decorator";
import { WorkspaceAuthorizationService } from "./workspace-authorization.service";
import type { WorkspaceScopedRequest } from "./workspace-data-scope";

type AuthenticatedRequest = Request &
  WorkspaceScopedRequest & {
    user?: { id?: string } | null;
  };

@Injectable()
export class WorkspacePermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authorization: WorkspaceAuthorizationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requirement = this.reflector.getAllAndOverride<RequiredPermissions>(
      WORKSPACE_PERMISSIONS_METADATA,
      [context.getHandler(), context.getClass()],
    );
    if (!requirement || requirement.permissions.length === 0) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = request.user?.id;
    if (!userId) throw new UnauthorizedException("AUTHENTICATION_REQUIRED");

    const accessContext = await this.authorization.getAccessContext(userId);
    request.workspaceAccessContext = accessContext;
    const matches = requirement.permissions.map((permission) =>
      accessContext.permissions.includes(permission),
    );
    const allowed =
      requirement.mode === "any"
        ? matches.some(Boolean)
        : matches.every(Boolean);
    if (!allowed) {
      throw new ForbiddenException("WORKSPACE_PERMISSION_REQUIRED");
    }
    return true;
  }
}
