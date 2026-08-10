import { IsObject } from "class-validator";

export class UpdateTeamModuleAccessDto {
  @IsObject()
  modules!: Record<string, unknown>;
}
