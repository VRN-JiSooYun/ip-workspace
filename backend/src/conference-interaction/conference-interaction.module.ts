import { Module } from "@nestjs/common";
import { ConferenceInteractionController } from "./conference-interaction.controller";
import { ConferenceInteractionService } from "./conference-interaction.service";

@Module({
  controllers: [ConferenceInteractionController],
  providers: [ConferenceInteractionService],
})
export class ConferenceInteractionModule {}
