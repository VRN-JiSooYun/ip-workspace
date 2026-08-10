import { Body, Controller, Get, Param, Post, Query, Res } from "@nestjs/common";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { Response } from "express";
import { CompoundSearchQueryDto } from "./dto/compound-search-query.dto";
import { EmbodimentListQueryDto } from "./dto/embodiment-list-query.dto";
import { EmbodimentSearchDto } from "./dto/embodiment-search.dto";
import {
  PatentFavoriteDto,
  PatentFavoriteShareDto,
} from "./dto/patent-favorite.dto";
import { PatentDetailQueryDto } from "./dto/patent-detail-query.dto";
import { PatentInsightStatisticsDto } from "./dto/patent-insight-statistics.dto";
import { PatentListQueryDto } from "./dto/patent-list-query.dto";
import { PatentAnalysisService } from "./patent-analysis.service";
import { RequirePermissions } from "../authorization/require-permissions.decorator";
import { PatentMemberService } from "./patent-member.service";

@RequirePermissions("patentAnalysis.read")
@Controller("api/patents")
export class PatentAnalysisController {
  constructor(
    private readonly patentAnalysisService: PatentAnalysisService,
    private readonly patentMembers: PatentMemberService,
  ) {}

  @Get("my")
  async getMyPatents(
    @Session() session: UserSession,
    @Query() query: PatentListQueryDto,
  ) {
    return this.patentAnalysisService.getMyPatents(
      await this.withResolvedOwner(session.user.id, query),
    );
  }

  @Get("favorites")
  async getFavorites(
    @Session() session: UserSession,
    @Query() query: PatentListQueryDto,
  ) {
    return this.patentAnalysisService.getFavorites(
      await this.withResolvedOwner(session.user.id, query),
    );
  }

  @Post("favorites")
  async addFavorite(
    @Session() session: UserSession,
    @Body() body: PatentFavoriteDto,
  ) {
    return this.patentAnalysisService.addFavorite(
      await this.withResolvedOwner(session.user.id, body),
    );
  }

  @Post("favorites/remove")
  async removeFavorite(
    @Session() session: UserSession,
    @Body() body: PatentFavoriteDto,
  ) {
    return this.patentAnalysisService.removeFavorite(
      await this.withResolvedOwner(session.user.id, body),
    );
  }

  @Post("favorites/share")
  async shareFavorites(
    @Session() session: UserSession,
    @Body() body: PatentFavoriteShareDto,
  ) {
    return this.patentAnalysisService.shareFavorites(
      await this.withResolvedOwner(session.user.id, body),
    );
  }

  @Get("compound-search")
  async searchCompounds(
    @Session() session: UserSession,
    @Query() query: CompoundSearchQueryDto,
  ) {
    return this.patentAnalysisService.searchCompounds(
      await this.withResolvedOwner(session.user.id, query),
    );
  }

  @Get("compounds/:compoundId/patents")
  getPatentsByCompoundId(@Param("compoundId") compoundId: string) {
    return this.patentAnalysisService.getPatentsByCompoundId(compoundId);
  }

  @Post("insight/statistics")
  getPatentInsightStatistics(@Body() body: PatentInsightStatisticsDto) {
    return this.patentAnalysisService.getPatentInsightStatistics(body);
  }

  @Post("insight/refresh")
  refreshPatentInsightStatistics() {
    return this.patentAnalysisService.refreshPatentInsightStatistics();
  }

  @Get(":publicationNumber/pdf")
  async downloadPatentPdf(
    @Session() session: UserSession,
    @Param("publicationNumber") publicationNumber: string,
    @Query() query: PatentDetailQueryDto,
    @Res() response: Response,
  ) {
    const helperResponse = await this.patentAnalysisService.downloadPatentPdf(
      publicationNumber,
      await this.withResolvedOwner(session.user.id, query),
    );
    const filename = `${publicationNumber.replace(/[^A-Za-z0-9_-]/g, "_")}.pdf`;
    const contentTypeHeader = helperResponse.headers["content-type"];
    const contentType =
      typeof contentTypeHeader === "string"
        ? contentTypeHeader
        : "application/pdf";

    response.setHeader("Content-Type", contentType);
    response.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    helperResponse.data.pipe(response);
  }

  @Get(":publicationNumber/embodiments/excel")
  async downloadEmbodimentsExcel(
    @Session() session: UserSession,
    @Param("publicationNumber") publicationNumber: string,
    @Query() query: PatentDetailQueryDto,
    @Res() response: Response,
  ) {
    const helperResponse =
      await this.patentAnalysisService.downloadEmbodimentsExcel(
        publicationNumber,
        query.bioactivityType,
        await this.withResolvedOwner(session.user.id, query),
      );
    const suffix =
      query.bioactivityType === "modified_bioactivity"
        ? "clean_data"
        : "raw_data";
    const filename = `${publicationNumber.replace(/[^A-Za-z0-9_-]/g, "_")}_${suffix}_embodiments.xlsx`;
    const contentTypeHeader = helperResponse.headers["content-type"];
    const contentType =
      typeof contentTypeHeader === "string"
        ? contentTypeHeader
        : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    response.setHeader("Content-Type", contentType);
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`,
    );
    helperResponse.data.pipe(response);
  }

  @Get(":publicationNumber/embodiments")
  async getEmbodiments(
    @Session() session: UserSession,
    @Param("publicationNumber") publicationNumber: string,
    @Query() query: EmbodimentListQueryDto,
  ) {
    return this.patentAnalysisService.getEmbodiments(
      publicationNumber,
      await this.withResolvedOwner(session.user.id, query),
    );
  }

  @Post(":publicationNumber/embodiments/search")
  async searchEmbodiments(
    @Session() session: UserSession,
    @Param("publicationNumber") publicationNumber: string,
    @Body() body: EmbodimentSearchDto,
  ) {
    return this.patentAnalysisService.searchEmbodiments(
      publicationNumber,
      body,
      await this.resolveOwnerId(session.user.id),
    );
  }

  @Get(":publicationNumber")
  async getPatentDetail(
    @Session() session: UserSession,
    @Param("publicationNumber") publicationNumber: string,
    @Query() query: PatentDetailQueryDto,
  ) {
    return this.patentAnalysisService.getPatentDetail(
      publicationNumber,
      await this.withResolvedOwner(session.user.id, query),
    );
  }

  private async resolveOwnerId(userId: string): Promise<string> {
    const member = await this.patentMembers.resolve(userId);
    return String(member.memberId);
  }

  private async withResolvedOwner<T extends object>(
    userId: string,
    input: T,
  ): Promise<T & { ownerId: string }> {
    return {
      ...input,
      ownerId: await this.resolveOwnerId(userId),
    };
  }
}
