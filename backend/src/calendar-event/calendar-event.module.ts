import { Module } from "@nestjs/common";
import { CalendarEventController } from "./calendar-event.controller";
import { CalendarEventService } from "./calendar-event.service";

@Module({
  controllers: [CalendarEventController],
  providers: [CalendarEventService],
})
export class CalendarEventModule {}
