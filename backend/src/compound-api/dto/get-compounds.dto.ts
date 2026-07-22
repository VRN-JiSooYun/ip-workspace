import { ArrayNotEmpty, IsArray, IsIn, IsString } from 'class-validator';

export class GetCompoundsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  compounds!: string[];

  @IsString()
  @IsIn(['smiles'])
  type: 'smiles' = 'smiles';
}
