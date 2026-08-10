import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Param,
  Patch,
} from "@nestjs/common";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { randomUUID } from "node:crypto";
import { RequirePermissions } from "../authorization/require-permissions.decorator";
import { AdminUsersService } from "./admin-users.service";
import { UpdateUserAccessDto } from "./dto/update-user-access.dto";

@RequirePermissions("userAccess.manage")
@Controller("api/admin/users")
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @Get()
  listUsers(@Session() session: UserSession) {
    this.assertFreshSession(session);
    return this.users.listUsers();
  }

  @Patch(":userId/access")
  updateAccess(
    @Session() session: UserSession,
    @Param("userId") userId: string,
    @Body() body: UpdateUserAccessDto,
    @Headers("x-request-id") requestId?: string,
  ) {
    this.assertFreshSession(session);
    return this.users.updateAccess(
      session.user.id,
      userId,
      body,
      requestId ?? randomUUID(),
    );
  }

  private assertFreshSession(session: UserSession): void {
    const createdAt = new Date(String(session.session.createdAt)).getTime();
    if (
      !Number.isFinite(createdAt) ||
      Date.now() - createdAt > 30 * 60 * 1000
    ) {
      throw new ForbiddenException("FRESH_SESSION_REQUIRED");
    }
  }
}
