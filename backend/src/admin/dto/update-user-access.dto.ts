import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

export class UpdateUserAccessDto {
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(["SUPER_ADMIN", "CONFERENCE_ADMIN", "PATENT_ANALYSIS_ADMIN"], {
    each: true,
  })
  adminRoles?: Array<
    "SUPER_ADMIN" | "CONFERENCE_ADMIN" | "PATENT_ANALYSIS_ADMIN"
  >;

  @IsOptional()
  @IsIn(["ACTIVE", "INACTIVE"])
  status?: "ACTIVE" | "INACTIVE";

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
