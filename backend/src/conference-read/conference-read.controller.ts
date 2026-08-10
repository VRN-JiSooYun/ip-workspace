import { Controller, Get, Param, ParseUUIDPipe, Query } from "@nestjs/common";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { RequirePermissions } from "../authorization/require-permissions.decorator";
import { WorkspaceAccess } from "../authorization/workspace-access.decorator";
import type { WorkspaceAccessContext } from "../authorization/workspace-authorization.service";
import { WorkspaceAuthorizationService } from "../authorization/workspace-authorization.service";
import { organizationIdForScope } from "../authorization/workspace-data-scope";
import { ConferenceReadService } from "./conference-read.service";
import { ConferenceAbstractSearchQueryDto } from "./dto/conference-abstract-search-query.dto";

@RequirePermissions("conference.read")
@Controller("api")
export class ConferenceReadController {
  constructor(
    private readonly conferences: ConferenceReadService,
    private readonly authorization: WorkspaceAuthorizationService,
  ) {}

  @Get("conference-abstracts")
  searchAbstracts(
    @Session() session: UserSession,
    @WorkspaceAccess() access: WorkspaceAccessContext,
    @Query() query: ConferenceAbstractSearchQueryDto,
  ) {
    return this.conferences.searchAbstracts(
      session.user.id,
      query,
      this.organizationId(access),
    );
  }

  @Get("conferences/:conferenceId")
  getConference(
    @WorkspaceAccess() access: WorkspaceAccessContext,
    @Param("conferenceId", new ParseUUIDPipe({ version: "4" }))
    conferenceId: string,
  ) {
    return this.conferences.getConference(
      conferenceId,
      this.organizationId(access),
    );
  }

  @Get("conference-abstracts/:abstractId")
  getAbstract(
    @Session() session: UserSession,
    @WorkspaceAccess() access: WorkspaceAccessContext,
    @Param("abstractId", new ParseUUIDPipe({ version: "4" }))
    abstractId: string,
  ) {
    return this.conferences.getAbstract(
      session.user.id,
      abstractId,
      this.organizationId(access),
    );
  }

  private organizationId(access: WorkspaceAccessContext): string | undefined {
    return organizationIdForScope(
      this.authorization.resolveDataScope(access, "conference"),
    );
  }
}
