import { Controller, Get } from "@nestjs/common";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { WorkspaceAuthorizationService } from "./workspace-authorization.service";

@Controller("api/access-context")
export class AccessContextController {
  constructor(private readonly authorization: WorkspaceAuthorizationService) {}

  @Get()
  getAccessContext(@Session() session: UserSession) {
    return this.authorization.getAccessContext(session.user.id);
  }
}
