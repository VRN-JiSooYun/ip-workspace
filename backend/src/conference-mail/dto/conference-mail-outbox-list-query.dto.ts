import { Transform } from "class-transformer";
import { IsIn, IsInt, IsOptional, Max, Min } from "class-validator";

export class ConferenceMailOutboxListQueryDto {
  @IsOptional()
  @IsIn(["PENDING", "PROCESSING", "RETRY", "SENT", "FAILED"])
  status?: "PENDING" | "PROCESSING" | "RETRY" | "SENT" | "FAILED";

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50;
}
