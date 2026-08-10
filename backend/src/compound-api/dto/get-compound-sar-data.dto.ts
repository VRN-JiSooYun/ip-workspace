import { ArrayNotEmpty, IsArray, IsString } from "class-validator";

export class GetCompoundSarDataDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  compounds!: string[];
}
