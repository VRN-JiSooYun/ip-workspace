import { Transform } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEmail,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";

export class CreateConferenceCommentDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  content!: string;

  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsUUID("4", { each: true })
  recipientIds: string[] = [];

  @Transform(({ value }) =>
    Array.isArray(value)
      ? value.map((email) =>
          typeof email === "string" ? email.trim().toLowerCase() : email,
        )
      : value,
  )
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsEmail({}, { each: true })
  @MaxLength(320, { each: true })
  recipientEmails: string[] = [];
}
