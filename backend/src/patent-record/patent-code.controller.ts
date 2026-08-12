import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from "@nestjs/common";
import { RequirePermissions } from "../authorization/require-permissions.decorator";
import { PatentCodeBodyDto } from "./dto/patent-code.dto";
import {
  PATENT_CODE_TYPES,
  PatentCodeService,
  type PatentCodeType,
} from "./patent-code.service";
import { ParsePatentCodeTypePipe } from "./parse-patent-code-type.pipe";

/**
 * 특허 도메인 코드 테이블(country, attorney, legal_status, exam_status) 관리.
 * 네 테이블의 모양이 같아 `:type`으로 묶었다. 허용값은 PATENT_CODE_TYPES뿐이다.
 */
@RequirePermissions("patentAnalysis.read")
@Controller("api/patent-codes")
export class PatentCodeController {
  constructor(private readonly codes: PatentCodeService) {}

  @Get("types")
  listTypes() {
    return { types: PATENT_CODE_TYPES };
  }

  @Get(":type")
  list(@Param("type", ParsePatentCodeTypePipe) type: PatentCodeType) {
    return this.codes.list(type);
  }

  @RequirePermissions("patentAnalysis.manage")
  @Post(":type")
  create(
    @Param("type", ParsePatentCodeTypePipe) type: PatentCodeType,
    @Body() body: PatentCodeBodyDto,
  ) {
    return this.codes.create(type, body);
  }

  @RequirePermissions("patentAnalysis.manage")
  @Patch(":type/:id")
  update(
    @Param("type", ParsePatentCodeTypePipe) type: PatentCodeType,
    @Param("id", ParseIntPipe) id: number,
    @Body() body: PatentCodeBodyDto,
  ) {
    return this.codes.update(type, id, body);
  }

  @RequirePermissions("patentAnalysis.manage")
  @Delete(":type/:id")
  remove(
    @Param("type", ParsePatentCodeTypePipe) type: PatentCodeType,
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.codes.remove(type, id);
  }
}
