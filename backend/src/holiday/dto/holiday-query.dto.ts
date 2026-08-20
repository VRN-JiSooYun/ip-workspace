import { Transform } from "class-transformer";
import { IsInt, Max, Min } from "class-validator";

export class HolidayQueryDto {
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;
}
