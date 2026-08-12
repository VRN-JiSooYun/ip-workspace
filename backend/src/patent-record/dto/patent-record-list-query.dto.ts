import { Transform } from "class-transformer";
import {
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
