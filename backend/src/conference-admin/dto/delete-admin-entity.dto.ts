import { IsDateString, IsOptional } from "class-validator";

export class DeleteAdminEntityDto {
  @IsOptional()
  @IsDateString()
  expectedUpdatedAt?: string;
}
