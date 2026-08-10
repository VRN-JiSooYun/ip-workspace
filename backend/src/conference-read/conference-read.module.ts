import { Module } from "@nestjs/common";
import { ConferenceReadController } from "./conference-read.controller";
import { ConferenceReadService } from "./conference-read.service";

@Module({
  controllers: [ConferenceReadController],
  providers: [ConferenceReadService],
})
export class ConferenceReadModule {}
