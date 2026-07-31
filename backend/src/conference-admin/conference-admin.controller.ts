import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { randomUUID } from 'node:crypto';
import { RequirePermissions } from '../authorization/require-permissions.decorator';
import { ConferenceAdminService } from './conference-admin.service';
import { AdminConferenceListQueryDto } from './dto/admin-conference-list-query.dto';
import { AdminConferenceAbstractListQueryDto } from './dto/admin-conference-abstract-list-query.dto';
import { CreateAdminConferenceDto } from './dto/create-admin-conference.dto';
import { UpdateAdminConferenceDto } from './dto/update-admin-conference.dto';
import { CreateAdminConferenceAbstractDto } from './dto/create-admin-conference-abstract.dto';
import { UpdateAdminConferenceAbstractDto } from './dto/update-admin-conference-abstract.dto';
import { DeleteAdminEntityDto } from './dto/delete-admin-entity.dto';
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

  @Get('conferences')
  listConferences(
    @WorkspaceAccess() access: WorkspaceAccessContext,
    @Query() query: AdminConferenceListQueryDto,
  ) {
    return this.conferences.listConferences(query, this.organizationId(access));
  }

  @Get('conference-abstracts')
  listAbstracts(
    @WorkspaceAccess() access: WorkspaceAccessContext,
    @Query() query: AdminConferenceAbstractListQueryDto,
  ) {
    return this.conferences.listAbstracts(query, this.organizationId(access));
  }

  @Post('conferences')
  createConference(
    @Session() session: UserSession,
    @WorkspaceAccess() access: WorkspaceAccessContext,
    @Body() body: CreateAdminConferenceDto,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.conferences.createConference(
      this.organizationId(access) ?? access.organization?.id ?? DEFAULT_ORGANIZATION_ID,
      body,
      session.user.id,
      requestId ?? randomUUID(),
    );
  }

  @Patch('conferences/:conferenceId')
  updateConference(
    @Session() session: UserSession,
    @WorkspaceAccess() access: WorkspaceAccessContext,
    @Param('conferenceId', new ParseUUIDPipe({ version: '4' })) conferenceId: string,
    @Body() body: UpdateAdminConferenceDto,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.conferences.updateConference(
      conferenceId,
      body,
      this.organizationId(access),
      session.user.id,
      requestId ?? randomUUID(),
    );
  }

  @Delete('conferences/:conferenceId')
  deleteConference(
    @Session() session: UserSession,
    @WorkspaceAccess() access: WorkspaceAccessContext,
    @Param('conferenceId', new ParseUUIDPipe({ version: '4' })) conferenceId: string,
    @Body() body: DeleteAdminEntityDto,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.conferences.deleteConference(
      conferenceId,
      body.expectedUpdatedAt,
      this.organizationId(access),
      session.user.id,
      requestId ?? randomUUID(),
    );
  }

  @Post('conferences/:conferenceId/restore')
  restoreConference(
    @Session() session: UserSession,
    @WorkspaceAccess() access: WorkspaceAccessContext,
    @Param('conferenceId', new ParseUUIDPipe({ version: '4' })) conferenceId: string,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.conferences.restoreConference(
      conferenceId,
      this.organizationId(access),
      session.user.id,
      requestId ?? randomUUID(),
    );
  }

  @Post('conferences/:conferenceId/abstracts')
  createAbstract(
    @Session() session: UserSession,
    @WorkspaceAccess() access: WorkspaceAccessContext,
    @Param('conferenceId', new ParseUUIDPipe({ version: '4' })) conferenceId: string,
    @Body() body: CreateAdminConferenceAbstractDto,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.conferences.createAbstract(
      conferenceId,
      body,
      this.organizationId(access),
      session.user.id,
      requestId ?? randomUUID(),
    );
  }

  @Patch('conference-abstracts/:abstractId')
  updateAbstract(
    @Session() session: UserSession,
    @WorkspaceAccess() access: WorkspaceAccessContext,
    @Param('abstractId', new ParseUUIDPipe({ version: '4' })) abstractId: string,
    @Body() body: UpdateAdminConferenceAbstractDto,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.conferences.updateAbstract(
      abstractId,
      body,
      this.organizationId(access),
      session.user.id,
      requestId ?? randomUUID(),
    );
  }

  @Delete('conference-abstracts/:abstractId')
  deleteAbstract(
    @Session() session: UserSession,
    @WorkspaceAccess() access: WorkspaceAccessContext,
    @Param('abstractId', new ParseUUIDPipe({ version: '4' })) abstractId: string,
    @Body() body: DeleteAdminEntityDto,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.conferences.deleteAbstract(
      abstractId,
      body.expectedUpdatedAt,
      this.organizationId(access),
      session.user.id,
      requestId ?? randomUUID(),
    );
  }

  @Post('conference-abstracts/:abstractId/restore')
  restoreAbstract(
    @Session() session: UserSession,
    @WorkspaceAccess() access: WorkspaceAccessContext,
    @Param('abstractId', new ParseUUIDPipe({ version: '4' })) abstractId: string,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.conferences.restoreAbstract(
      abstractId,
      this.organizationId(access),
      session.user.id,
      requestId ?? randomUUID(),
    );
  }

  private organizationId(access: WorkspaceAccessContext): string | undefined {
    return organizationIdForScope(
      this.authorization.resolveDataScope(access, 'conference'),
    );
  }
}
