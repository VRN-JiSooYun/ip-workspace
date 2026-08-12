import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

/** 코드 테이블의 공통 body. `value`는 표시값, `id`는 attorney 전용 PK다. */
export class PatentCodeBodyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  value!: string;

  /**
   * attorney는 PK가 외부 시스템의 attorney_number라 autoincrement가 아니다.
   * 생성 시에만 필요하고 나머지 코드 테이블에서는 무시된다.
   */
  @IsOptional()
  @IsInt()
  id?: number;
}
