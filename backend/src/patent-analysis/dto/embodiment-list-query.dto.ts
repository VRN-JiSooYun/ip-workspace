import { Transform } from "class-transformer";
import { IsInt, IsOptional, IsString, Min } from "class-validator";

export class EmbodimentListQueryDto {
  @IsOptional()
  @IsString()
  ownerId?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  pageSize = 10;

  @IsOptional()
  @IsString()
  filter?: string;

  @IsOptional()
  @IsString()
  ligandFilter?: string;

  @IsOptional()
  @IsString()
  order?: string;
}
