import { Type } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

export class EmbodimentBioactivityFilterDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  key!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowInfinity: false, allowNaN: false })
  min?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowInfinity: false, allowNaN: false })
  max?: number;
}

export class EmbodimentRGroupFilterDto {
  @IsString()
  @Matches(/^R\d+$/)
  key!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  value!: string;
}

export class EmbodimentSearchDto {
  @IsIn(["raw", "clean"])
  dataset!: "raw" | "clean";

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([10, 30, 50, 100])
  pageSize = 30;

  @IsOptional()
  @IsBoolean()
  humanKeyCompound?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  rankingMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  rankingMax?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  scaffoldRanking?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageNumber?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => EmbodimentBioactivityFilterDto)
  bioactivity?: EmbodimentBioactivityFilterDto;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  scaffold?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => EmbodimentRGroupFilterDto)
  rGroup?: EmbodimentRGroupFilterDto;
}
