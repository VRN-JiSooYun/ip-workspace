import { Body, Controller, Post } from "@nestjs/common";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { GroupwareTokenService } from "../auth/groupware-token.service";
import { CompoundApiService } from "./compound-api.service";
import { GetCompoundCalculateDto } from "./dto/get-compound-calculate.dto";
import { GetCompoundSarDataDto } from "./dto/get-compound-sar-data.dto";
import { GetCompoundsDto } from "./dto/get-compounds.dto";
import { SearchCompoundsDto } from "./dto/search-compounds.dto";

@Controller("api/compound-api")
export class CompoundApiController {
  constructor(
    private readonly compoundApiService: CompoundApiService,
    private readonly groupwareToken: GroupwareTokenService,
  ) {}

  @Post("search-compounds")
  async searchCompounds(
    @Session() session: UserSession,
    @Body() body: SearchCompoundsDto,
  ) {
    return this.compoundApiService.searchCompounds(
      session.user.id,
      await this.groupwareToken.getForUser(session.user.id),
      body,
    );
  }

  @Post("get-compounds")
  async getCompounds(
    @Session() session: UserSession,
    @Body() body: GetCompoundsDto,
  ) {
    return this.compoundApiService.getCompounds(
      session.user.id,
      await this.groupwareToken.getForUser(session.user.id),
      body,
    );
  }

  @Post("get-compound-sar-data")
  async getCompoundSarData(
    @Session() session: UserSession,
    @Body() body: GetCompoundSarDataDto,
  ) {
    return this.compoundApiService.getCompoundSarData(
      session.user.id,
      await this.groupwareToken.getForUser(session.user.id),
      body,
    );
  }

  @Post("get-compound-calculate")
  async getCompoundCalculate(
    @Session() session: UserSession,
    @Body() body: GetCompoundCalculateDto,
  ) {
    return this.compoundApiService.getCompoundCalculate(
      session.user.id,
      await this.groupwareToken.getForUser(session.user.id),
      body,
    );
  }
}
