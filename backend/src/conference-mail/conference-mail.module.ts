import { Module } from "@nestjs/common";
import { ConferenceMailAdminController } from "./conference-mail-admin.controller";
import { ConferenceMailAdminService } from "./conference-mail-admin.service";
import { ConferenceMailWorkerService } from "./conference-mail-worker.service";
import { GmailMailProvider } from "./gmail-mail.provider";

@Module({
  controllers: [ConferenceMailAdminController],
  providers: [
    GmailMailProvider,
    ConferenceMailWorkerService,
    ConferenceMailAdminService,
  ],
})
export class ConferenceMailModule {}
