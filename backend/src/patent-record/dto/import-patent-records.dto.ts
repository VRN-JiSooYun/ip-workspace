import { IsIn, IsOptional } from "class-validator";

/** multipart 필드는 문자열로 도착하므로 문자열 그대로 검증한다. */
export class ImportPatentRecordsDto {
  @IsIn(["DRY_RUN", "APPLY"])
  mode!: "DRY_RUN" | "APPLY";

  /** 이미 있는 출원번호를 만났을 때. 기본은 건너뛰기. */
  @IsOptional()
  @IsIn(["SKIP", "UPDATE"])
  duplicateMode: "SKIP" | "UPDATE" = "SKIP";
}
