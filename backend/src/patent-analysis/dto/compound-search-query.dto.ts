import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CompoundSearchQueryDto {
  @IsOptional()
  @IsString()
  ownerId?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  wasm = 1;

  @IsString()
  smiles!: string;

  @IsOptional()
  @IsString()
  type = 'substructure';

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  sim = 70;

  @IsOptional()
  @IsString()
  actionType = 'GET-ELASTIC-COMPOUND-LIST';

  @IsOptional()
  @IsString()
  operation = 'GET-ELASTIC-COMPOUND-LIST';

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  size = 100;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  patentPageSize = 25;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  compoundPageSize = 100;
}
