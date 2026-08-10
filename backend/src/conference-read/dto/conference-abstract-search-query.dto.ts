import { Transform } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";

const optionalBoolean = ({ value }: { value: unknown }) => {
  if (value === undefined || value === "") return undefined;
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return value;
};

const csvStrings = ({ value }: { value: unknown }): string[] | undefined => {
  if (value === undefined || value === "") return undefined;
  const values = Array.isArray(value) ? value : String(value).split(",");
  return [
    ...new Set(values.map((item) => String(item).trim()).filter(Boolean)),
  ];
};

const csvNumbers = ({ value }: { value: unknown }): number[] | undefined => {
  const values = csvStrings({ value });
  return values?.map(Number);
};

export class ConferenceAbstractSearchQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @IsIn(["all", "conference", "title", "author", "abstractNumber"])
  searchField: "all" | "conference" | "title" | "author" | "abstractNumber" =
    "all";

  @IsOptional()
  @Transform(csvStrings)
  @IsArray()
  @IsUUID("4", { each: true })
  conferenceIds?: string[];

  @IsOptional()
  @Transform(csvNumbers)
  @IsArray()
  @IsInt({ each: true })
  @Min(1900, { each: true })
  @Max(2200, { each: true })
  years?: number[];

  @IsOptional()
  @Transform(optionalBoolean)
  @IsBoolean()
  favoriteOnly?: boolean;

  @IsOptional()
  @IsIn(["conferencePeriod", "dateOpen"])
  dateField: "conferencePeriod" | "dateOpen" = "conferencePeriod";

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @Transform(optionalBoolean)
  @IsBoolean()
  hasPoster?: boolean;

  @IsOptional()
  @Transform(optionalBoolean)
  @IsBoolean()
  hasVideo?: boolean;

  @IsOptional()
  @Transform(optionalBoolean)
  @IsBoolean()
  hasDocument?: boolean;

  @IsOptional()
  @IsIn([
    "conferenceYearDesc",
    "abstractNumberAsc",
    "titleAsc",
    "dateOpenDesc",
    "commentCountDesc",
  ])
  sort:
    | "conferenceYearDesc"
    | "abstractNumberAsc"
    | "titleAsc"
    | "dateOpenDesc"
    | "commentCountDesc" = "conferenceYearDesc";

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
  pageSize = 30;
}
