import { IsOptional, IsString } from 'class-validator';

export class PatentDetailQueryDto {
  @IsOptional()
  @IsString()
  ownerId?: string;
}
