import { Module } from '@nestjs/common';
import { ConferenceAdminController } from './conference-admin.controller';
import { ConferenceAdminService } from './conference-admin.service';

@Module({
  controllers: [ConferenceAdminController],
  providers: [ConferenceAdminService],
})
export class ConferenceAdminModule {}
