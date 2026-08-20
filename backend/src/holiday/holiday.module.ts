import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";
import { GoogleCalendarClient } from "./google-calendar.client";
import { HolidayController } from "./holiday.controller";
import { HolidayService } from "./holiday.service";

@Module({
  imports: [HttpModule],
  controllers: [HolidayController],
  providers: [GoogleCalendarClient, HolidayService],
  exports: [HolidayService],
})
export class HolidayModule {}
