import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from "@nestjs/common";
import { RequirePermissions } from "../authorization/require-permissions.decorator";
import { ConferenceMailAdminService } from "./conference-mail-admin.service";
import { ConferenceMailOutboxListQueryDto } from "./dto/conference-mail-outbox-list-query.dto";
import { WorkspaceAccess } from "../authorization/workspace-access.decorator";
import type { WorkspaceAccessContext } from "../authorization/workspace-authorization.service";
import { WorkspaceAuthorizationService } from "../authorization/workspace-authorization.service";
import { organizationIdForScope } from "../authorization/workspace-data-scope";

@RequirePermissions("conference.manage")
@Controller("api/admin/conference-mail-outbox")
export class ConferenceMailAdminController {
  constructor(
    private readonly mail: ConferenceMailAdminService,
    private readonly authorization: WorkspaceAuthorizationService,
  ) {}

  @Get("health")
  health(@WorkspaceAccess() access: WorkspaceAccessContext) {
    return this.mail.health(this.organizationId(access));
  }

  @Get()
  list(
    @WorkspaceAccess() access: WorkspaceAccessContext,
    @Query() query: ConferenceMailOutboxListQueryDto,
  ) {
    return this.mail.list(query, this.organizationId(access));
  }

  @Post(":outboxId/retry")
  retry(
    @WorkspaceAccess() access: WorkspaceAccessContext,
    @Param("outboxId", new ParseUUIDPipe({ version: "4" })) outboxId: string,
  ) {
    return this.mail.retry(outboxId, this.organizationId(access));
  }

  private organizationId(access: WorkspaceAccessContext): string | undefined {
    return organizationIdForScope(
      this.authorization.resolveDataScope(access, "conference"),
    );
  }
}
