import { Transform } from "class-transformer";
import { IsIn, IsInt, IsOptional, Max, Min } from "class-validator";
import { PatentStageQueryDto } from "./patent-stage-query.dto";

/** 목록 전용 항목(정렬·페이지)만 더한다. 필터는 진행 현황 집계와 공유한다. */
export class PatentRecordListQueryDto extends PatentStageQueryDto {
  @IsOptional()
  @IsIn([
    "applicationDateDesc",
    "applicationDateAsc",
    "applicationNumberAsc",
    "idDesc",
  ])
  sort:
    | "applicationDateDesc"
    | "applicationDateAsc"
    | "applicationNumberAsc"
    | "idDesc" = "applicationDateDesc";

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;
}
