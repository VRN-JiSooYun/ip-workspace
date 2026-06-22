import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class GenerateConformerDto {
  @IsString()
  smiles: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  generation_methods?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  max_attempts?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  num_confs?: number;

  @IsOptional()
  @IsString()
  optimization_method?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  max_iters?: number;

  @IsOptional()
  @IsIn(['sdf'])
  return_format?: 'sdf';

  @IsOptional()
  @IsInt()
  random_seed?: number;
}
