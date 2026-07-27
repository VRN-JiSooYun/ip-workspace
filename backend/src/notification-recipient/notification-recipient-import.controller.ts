import { Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Roles, Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { NotificationRecipientImportService } from './notification-recipient-import.service';
import { NotificationRecipientSyncService } from './notification-recipient-sync.service';

@Roles(['ADMIN'])
@Controller('api/admin/notification-recipient-imports')
export class NotificationRecipientImportController {
  constructor(
    private readonly imports: NotificationRecipientImportService,
    private readonly sync: NotificationRecipientSyncService,
  ) {}

  @Post('dry-run')
  dryRun(@Session() session: UserSession) {
    return this.imports.execute(session.user.id, 'DRY_RUN');
  }

  @Post()
  apply(@Session() session: UserSession) {
    return this.imports.execute(session.user.id, 'APPLY');
  }

  @Get()
  listRuns() {
    return this.imports.listRuns();
  }

  @Get(':runId')
  getRun(
    @Param('runId', new ParseUUIDPipe({ version: '4' })) runId: string,
  ) {
    return this.imports.getRun(runId);
  }

  @Post('reconcile-users')
  reconcileUsers() {
    return this.sync.reconcileAllUsers();
  }
}
