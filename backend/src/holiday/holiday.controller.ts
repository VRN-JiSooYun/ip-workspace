import { Controller, Get, Query } from "@nestjs/common";
import { RequirePermissions } from "../authorization/require-permissions.decorator";
import { HolidayQueryDto } from "./dto/holiday-query.dto";
import { HolidayService } from "./holiday.service";

/**
 * 달력에 칠할 공휴일·사내 휴무일. Google Calendar를 백엔드가 대신 읽어 캐시한다.
 *
 * 프런트가 직접 Google을 부르지 않는 이유는 자격증명 노출과 CORS 때문이고,
 * 캐시가 여기 있어야 사용자 수와 무관하게 상위 API 호출량이 일정하다.
 */
@RequirePermissions("patentAnalysis.read")
@Controller("api/holidays")
export class HolidayController {
  constructor(private readonly holidays: HolidayService) {}

  @Get()
  findByYear(@Query() query: HolidayQueryDto) {
    return this.holidays.findByYear(query.year);
  }
}
