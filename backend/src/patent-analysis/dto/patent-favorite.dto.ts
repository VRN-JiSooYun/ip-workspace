import { IsOptional, IsString } from "class-validator";

export class PatentFavoriteDto {
  @IsOptional()
  @IsString()
  ownerId?: string;

  @IsString()
  publicationNumber!: string;
}

export class PatentFavoriteShareDto {
  @IsOptional()
  @IsString()
  ownerId?: string;

  @IsString()
  cc!: string;
}
