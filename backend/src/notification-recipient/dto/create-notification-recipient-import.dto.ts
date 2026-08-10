import { IsString, Matches } from "class-validator";

export class CreateNotificationRecipientImportDto {
  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/)
  batchKey!: string;
}
