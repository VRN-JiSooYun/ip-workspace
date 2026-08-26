import { Transform } from "class-transformer";
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from "class-validator";

/** 활동 피드 조회. 최신순 + id 커서. */
export class PatentAuditLogQueryDto {
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  /**
   * 마지막으로 받은 로그 id. createdAt이 아니라 id로 이어 받는다 — 한 요청에서 여러
   * 필드가 바뀌면 시각이 같은 행이 여럿이라 시각 커서로는 건너뛰거나 겹친다.
   */
  @IsOptional()
  @IsString()
  @IsUUID()
  cursor?: string;
}
