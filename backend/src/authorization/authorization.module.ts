import { Global, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AccessContextController } from "./access-context.controller";
import { WorkspaceAuthorizationService } from "./workspace-authorization.service";
import { WorkspacePermissionGuard } from "./workspace-permission.guard";
import { TeamMembershipSyncService } from "./team-membership-sync.service";
import { TeamAccessAdminController } from "./team-access-admin.controller";
import { TeamAccessAdminService } from "./team-access-admin.service";

@Global()
@Module({
  controllers: [AccessContextController, TeamAccessAdminController],
  providers: [
    WorkspaceAuthorizationService,
    TeamMembershipSyncService,
    TeamAccessAdminService,
    WorkspacePermissionGuard,
    { provide: APP_GUARD, useExisting: WorkspacePermissionGuard },
  ],
  exports: [WorkspaceAuthorizationService],
})
export class AuthorizationModule {}
