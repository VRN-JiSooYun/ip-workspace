import { Module } from "@nestjs/common";
import { OaLookupController } from "./oa-lookup.controller";
import { OaLookupService } from "./oa-lookup.service";

@Module({
  controllers: [OaLookupController],
  providers: [OaLookupService],
  exports: [OaLookupService],
})
export class OaLookupModule {}
