import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { FileInterceptor } from '@nestjs/platform-express';
import { RequirePermissions } from '../authorization/require-permissions.decorator';
import { SkipTimeout } from '../common/decorators/skip-timeout.decorator';
import { CreateNotificationRecipientImportDto } from './dto/create-notification-recipient-import.dto';
import { NotificationRecipientImportService } from './notification-recipient-import.service';
import {
  NOTIFICATION_RECIPIENT_UPLOAD_MAX_FILE_BYTES,
  NOTIFICATION_RECIPIENT_UPLOAD_TEMP_DIRECTORY,
} from './notification-recipient-import-upload.constants';
import {
  NotificationRecipientImportUploadService,
  type NotificationRecipientUploadFile,
} from './notification-recipient-import-upload.service';
import { NotificationRecipientSyncService } from './notification-recipient-sync.service';

@RequirePermissions('conference.manage')
@Controller('api/admin/notification-recipient-imports')
export class NotificationRecipientImportController {
  constructor(
    private readonly imports: NotificationRecipientImportService,
    private readonly uploads: NotificationRecipientImportUploadService,
    private readonly sync: NotificationRecipientSyncService,
  ) {}

  @Post('batches')
  @SkipTimeout()
  @UseInterceptors(FileInterceptor('file', {
    dest: NOTIFICATION_RECIPIENT_UPLOAD_TEMP_DIRECTORY,
    limits: {
      files: 1,
      fileSize: NOTIFICATION_RECIPIENT_UPLOAD_MAX_FILE_BYTES,
    },
  }))
  uploadBatch(
    @Session() session: UserSession,
    @Body() body: Record<string, unknown>,
    @UploadedFile() file?: NotificationRecipientUploadFile,
  ) {
    return this.uploads.upload(session.user.id, body, file);
  }

  @Post('dry-run')
  dryRun(
    @Session() session: UserSession,
    @Body() body: CreateNotificationRecipientImportDto,
  ) {
    return this.imports.execute(session.user.id, 'DRY_RUN', body.batchKey);
  }

  @Post()
  apply(
    @Session() session: UserSession,
    @Body() body: CreateNotificationRecipientImportDto,
  ) {
    return this.imports.execute(session.user.id, 'APPLY', body.batchKey);
  }

  @Get()
  listRuns() {
    return this.imports.listRuns();
  }

  @Get('batches')
  listBatches() {
    return this.uploads.listBatches();
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
