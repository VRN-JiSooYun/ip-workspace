import { Module } from '@nestjs/common';
import { NotificationRecipientImportController } from './notification-recipient-import.controller';
import { NotificationRecipientImportService } from './notification-recipient-import.service';
import { NotificationRecipientSyncService } from './notification-recipient-sync.service';

@Module({
  controllers: [NotificationRecipientImportController],
  providers: [
    NotificationRecipientImportService,
    NotificationRecipientSyncService,
  ],
  exports: [NotificationRecipientSyncService],
})
export class NotificationRecipientModule {}
