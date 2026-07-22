import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export enum RequestedQuantumJobType {
  PSA = 'PSA',
  ESOL = 'ESOL',
}

export class CreateQuantumCalculationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  compoundDraftKey!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  smiles!: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsEnum(RequestedQuantumJobType, { each: true })
  jobTypes!: RequestedQuantumJobType[];
}
