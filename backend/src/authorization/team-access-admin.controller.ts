import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { randomUUID } from 'node:crypto';
import { UpdateTeamModuleAccessDto } from './dto/update-team-module-access.dto';
import { RequirePermissions } from './require-permissions.decorator';
import { TeamAccessAdminService } from './team-access-admin.service';

@RequirePermissions('userAccess.manage')
@Controller('api/admin/access/teams')
export class TeamAccessAdminController {
  constructor(private readonly teams: TeamAccessAdminService) {}

  @Get()
  listTeams() {
    return this.teams.listTeams();
  }

  @Post('reconcile')
  reconcileTeams() {
    return this.teams.reconcileTeams();
  }

  @Patch(':teamId/modules')
  updateModules(
    @Session() session: UserSession,
    @Param('teamId') teamId: string,
    @Body() body: UpdateTeamModuleAccessDto,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.teams.updateTeamModules(
      session.user.id,
      teamId,
      body.modules,
      requestId ?? randomUUID(),
    );
  }
}
