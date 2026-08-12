import { Transform } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class PatentRecordListQueryDto {
  /** 출원번호·명칭·출원인 부분 일치 검색. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  /** 선택한 Target 중 하나와 정확히 일치하는 관리 특허만 조회한다. */
  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  targets?: string[];

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  countryId?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  legalStatusId?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  examStatusId?: number;

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
