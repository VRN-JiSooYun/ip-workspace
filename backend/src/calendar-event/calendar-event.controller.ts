import { Body, Controller, Delete, Get, Param, Post, Put, Query } from "@nestjs/common";
import { RequirePermissions } from "../authorization/require-permissions.decorator";
import { WorkspaceAccess } from "../authorization/workspace-access.decorator";
import type { WorkspaceAccessContext } from "../authorization/workspace-authorization.service";
import {
  CalendarEventQueryDto,
  CreateCalendarEventDto,
  UpdateCalendarEventDto,
} from "./dto/calendar-event.dto";
import { CalendarEventService, type CalendarActor } from "./calendar-event.service";

const toActor = (access: WorkspaceAccessContext): CalendarActor => ({
  userId: access.userId,
  teamIds: access.teams.map((team) => team.id),
});

/**
 * 대시보드 일정 위젯의 사용자 일정.
 *
 * 권한은 읽기(`patentAnalysis.read`) 하나만 요구한다. 쓰기에 `manage`를 걸지 않는 이유:
 * 여기서 만드는 것은 **자기 일정**이라 관리자 권한의 대상이 아니다. 남의 것을 건드리지
 * 못하게 하는 일은 권한이 아니라 소유자 검사(service)가 한다.
 *
 * 수정이 PATCH가 아니라 PUT인 것은 부분 수정을 받지 않기 때문이다(dto 주석 참고).
 */
@RequirePermissions("patentAnalysis.read")
@Controller("api/calendar-events")
export class CalendarEventController {
  constructor(private readonly events: CalendarEventService) {}

  @Get()
  list(
    @Query() query: CalendarEventQueryDto,
    @WorkspaceAccess() access: WorkspaceAccessContext,
  ) {
    return this.events.list(query, toActor(access));
  }

  @Post()
  create(
    @Body() body: CreateCalendarEventDto,
    @WorkspaceAccess() access: WorkspaceAccessContext,
  ) {
    return this.events.create(body, toActor(access));
  }

  @Put(":id")
  update(
    @Param("id") id: string,
    @Body() body: UpdateCalendarEventDto,
    @WorkspaceAccess() access: WorkspaceAccessContext,
  ) {
    return this.events.update(id, body, toActor(access));
  }

  @Delete(":id")
  remove(
    @Param("id") id: string,
    @WorkspaceAccess() access: WorkspaceAccessContext,
  ) {
    return this.events.remove(id, toActor(access));
  }
}
