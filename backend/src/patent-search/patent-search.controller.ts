import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
} from "@nestjs/common";
import { RequirePermissions } from "../authorization/require-permissions.decorator";
import { SkipTimeout } from "../common/decorators/skip-timeout.decorator";
import {
  PatentSearchDto,
  PatentSearchMatchesDto,
} from "./dto/patent-search.dto";
import { PatentSearchIndexService } from "./patent-search-index.service";
import { PatentSearchMatchesService } from "./patent-search-matches.service";
import { PatentSearchService } from "./patent-search.service";

/**
 * OA(의견제출통지서)·의견서·보정서 전문 검색.
 *
 * 조건이 body에 담기는 중첩 구조라 GET이 아닌 POST를 쓴다. 로컬 `patent` table을 다루는
 * `api/patent-records`, 특허 분석 helper를 중계하는 `api/patents`와는 별개 prefix다.
 */
@RequirePermissions("patentAnalysis.read")
@Controller("api/patent-search")
export class PatentSearchController {
  constructor(
    private readonly search: PatentSearchService,
    private readonly index: PatentSearchIndexService,
    private readonly matches: PatentSearchMatchesService,
  ) {}

  /** content 없는 전체 OA 인덱스. 일반 상세 필터는 프런트에서 이 데이터를 거른다. */
  @Get("index")
  @SkipTimeout()
  getIndex() {
    return this.index.getIndex();
  }

  /** BM25 전문 검색의 전체 OA ID와 관련도만 반환한다. 본문과 카드 관계는 응답하지 않는다. */
  @Post("matches")
  @HttpCode(HttpStatus.OK)
  @SkipTimeout()
  getMatches(@Body() body: PatentSearchMatchesDto) {
    return this.matches.search(body);
  }

  /** 인덱스에서 제외한 본문을 결과 카드 선택 시 한 건만 읽는다. */
  @Get(":officeActionId/content")
  getDocumentContent(@Param("officeActionId", ParseIntPipe) officeActionId: number) {
    return this.index.getDocumentContent(officeActionId);
  }

  /** 결과 1건은 특허가 아니라 OA 1건이다. */
  @Post()
  // 조건이 body에 담겨 POST일 뿐 조회다. Nest 기본값 201이 아니라 200을 돌려준다.
  @HttpCode(HttpStatus.OK)
  // 외부 API가 size=100에서 수 초 걸리고 본문도 MB 단위라 전역 timeout을 적용하지 않는다.
  @SkipTimeout()
  run(@Body() body: PatentSearchDto) {
    return this.search.search(body);
  }
}
