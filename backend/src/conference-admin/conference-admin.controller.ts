import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { RequirePermissions } from '../authorization/require-permissions.decorator';
import { ConferenceAdminService } from './conference-admin.service';
import { CreateAdminConferenceDto } from './dto/create-admin-conference.dto';
import { UpdateAdminConferenceDto } from './dto/update-admin-conference.dto';
import { CreateAdminConferenceAbstractDto } from './dto/create-admin-conference-abstract.dto';
import { UpdateAdminConferenceAbstractDto } from './dto/update-admin-conference-abstract.dto';
import { WorkspaceAccess } from '../authorization/workspace-access.decorator';
import type { WorkspaceAccessContext } from '../authorization/workspace-authorization.service';
import { WorkspaceAuthorizationService } from '../authorization/workspace-authorization.service';
import { organizationIdForScope } from '../authorization/workspace-data-scope';
import { DEFAULT_ORGANIZATION_ID } from '../authorization/team-membership-sync.service';

@RequirePermissions('conference.manage')
@Controller('api/admin')
export class ConferenceAdminController {
  constructor(
    private readonly conferences: ConferenceAdminService,
    private readonly authorization: WorkspaceAuthorizationService,
  ) {}

  @Get('conferences/options')
  listConferenceOptions(@WorkspaceAccess() access: WorkspaceAccessContext) {
    return this.conferences.listConferenceOptions(this.organizationId(access));
  }

  @Post('conferences')
  createConference(
    @WorkspaceAccess() access: WorkspaceAccessContext,
    @Body() body: CreateAdminConferenceDto,
  ) {
    return this.conferences.createConference(
      this.organizationId(access) ?? access.organization?.id ?? DEFAULT_ORGANIZATION_ID,
      body,
    );
  }

  @Patch('conferences/:conferenceId')
  updateConference(
    @WorkspaceAccess() access: WorkspaceAccessContext,
    @Param('conferenceId', new ParseUUIDPipe({ version: '4' })) conferenceId: string,
    @Body() body: UpdateAdminConferenceDto,
  ) {
    return this.conferences.updateConference(
      conferenceId,
      body,
      this.organizationId(access),
    );
  }

  @Post('conferences/:conferenceId/abstracts')
  createAbstract(
    @WorkspaceAccess() access: WorkspaceAccessContext,
    @Param('conferenceId', new ParseUUIDPipe({ version: '4' })) conferenceId: string,
    @Body() body: CreateAdminConferenceAbstractDto,
  ) {
    return this.conferences.createAbstract(
      conferenceId,
      body,
      this.organizationId(access),
    );
  }

  @Patch('conference-abstracts/:abstractId')
  updateAbstract(
    @WorkspaceAccess() access: WorkspaceAccessContext,
    @Param('abstractId', new ParseUUIDPipe({ version: '4' })) abstractId: string,
    @Body() body: UpdateAdminConferenceAbstractDto,
  ) {
    return this.conferences.updateAbstract(
      abstractId,
      body,
      this.organizationId(access),
    );
  }

  private organizationId(access: WorkspaceAccessContext): string | undefined {
    return organizationIdForScope(
      this.authorization.resolveDataScope(access, 'conference'),
    );
  }
}
