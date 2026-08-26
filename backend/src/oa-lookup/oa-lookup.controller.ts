import { Controller, Get } from "@nestjs/common";
import { RequirePermissions } from "../authorization/require-permissions.decorator";
import { OaLookupService } from "./oa-lookup.service";

@RequirePermissions("patentAnalysis.read")
@Controller("api/oa-lookups")
export class OaLookupController {
  constructor(private readonly lookups: OaLookupService) {}

  @Get()
  list() {
    return this.lookups.list();
  }
}
