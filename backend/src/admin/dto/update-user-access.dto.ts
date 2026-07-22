import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateUserAccessDto {
  @IsOptional()
  @IsIn(['USER', 'ADMIN'])
  role?: 'USER' | 'ADMIN';

  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: 'ACTIVE' | 'INACTIVE';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
