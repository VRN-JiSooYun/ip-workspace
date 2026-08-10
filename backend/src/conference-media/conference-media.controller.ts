import { Controller, Get, Param, ParseUUIDPipe, Res } from "@nestjs/common";
import type { Response } from "express";
import { RequirePermissions } from "../authorization/require-permissions.decorator";
import { WorkspaceAccess } from "../authorization/workspace-access.decorator";
import type { WorkspaceAccessContext } from "../authorization/workspace-authorization.service";
import { WorkspaceAuthorizationService } from "../authorization/workspace-authorization.service";
import { organizationIdForScope } from "../authorization/workspace-data-scope";
import { ConferenceMediaService } from "./conference-media.service";

@RequirePermissions("conference.read")
@Controller("api/conference-assets")
export class ConferenceMediaController {
  constructor(
    private readonly conferenceMedia: ConferenceMediaService,
    private readonly authorization: WorkspaceAuthorizationService,
  ) {}

  @Get(":assetId/content")
  async getContent(
    @WorkspaceAccess() access: WorkspaceAccessContext,
    @Param("assetId", new ParseUUIDPipe({ version: "4" })) assetId: string,
    @Res() response: Response,
  ): Promise<void> {
    const target = await this.conferenceMedia.getContentTarget(
      assetId,
      this.organizationId(access),
    );
    response.redirect(302, target.url);
  }

  @Get(":assetId/download")
  async download(
    @WorkspaceAccess() access: WorkspaceAccessContext,
    @Param("assetId", new ParseUUIDPipe({ version: "4" })) assetId: string,
    @Res() response: Response,
  ): Promise<void> {
    await this.conferenceMedia.pipeDownload(
      assetId,
      response,
      this.organizationId(access),
    );
  }

  private organizationId(access: WorkspaceAccessContext): string | undefined {
    return organizationIdForScope(
      this.authorization.resolveDataScope(access, "conference"),
    );
  }
}
