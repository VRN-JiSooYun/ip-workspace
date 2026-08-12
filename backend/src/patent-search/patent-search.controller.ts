import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { RequirePermissions } from "../authorization/require-permissions.decorator";
import { SkipTimeout } from "../common/decorators/skip-timeout.decorator";
import { PatentSearchDto } from "./dto/patent-search.dto";
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
  constructor(private readonly search: PatentSearchService) {}

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
