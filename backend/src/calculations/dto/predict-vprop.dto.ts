import { IsString, Matches, MaxLength } from "class-validator";

export class PredictVpropDto {
  @IsString()
  @Matches(/\S/, { message: "smiles must contain a non-whitespace character" })
  @MaxLength(10000)
  smiles!: string;
}
