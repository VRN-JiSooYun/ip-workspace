import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class ThreeDPsaCallbackDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  job_id?: string;

  @IsString()
  @MinLength(36)
  @MaxLength(200)
  unique_key!: string;

  @IsString()
  @MaxLength(50)
  status!: string;

  @IsOptional()
  @IsString()
  result_data?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  error_message?: string;

  @IsString()
  @MaxLength(20)
  job_type!: string;

  // 현재는 저장하지 않으며 callback validation 통과와 향후 저장소 연동만 위해 허용한다.
  @IsOptional()
  @IsString()
  sdf_content?: string;

  @IsOptional()
  @IsString()
  sdf_3dpsa?: string;

  @IsOptional()
  @IsString()
  sdf_esol_solution?: string;

  @IsOptional()
  @IsString()
  sdf_esol_gas?: string;
}
