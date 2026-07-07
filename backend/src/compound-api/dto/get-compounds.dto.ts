import { ArrayNotEmpty, IsArray, IsIn, IsNotEmpty, IsString } from 'class-validator';

export class GetCompoundsDto {
  @IsString()
  @IsNotEmpty()
  login_token!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  compounds!: string[];

  @IsString()
  @IsIn(['smiles'])
  type: 'smiles' = 'smiles';
}
