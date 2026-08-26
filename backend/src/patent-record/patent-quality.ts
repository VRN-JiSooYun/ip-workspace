/**
 * 관리 특허 데이터의 품질 조건.
 *
 * 대시보드의 품질 카드가 세는 건수와, 그 카드에서 목록으로 넘어갈 때 걸리는 필터
 * (`GET /api/patent-records?quality=...`)가 **같은 표를 쓴다**. 두 곳에 조건을 복제하면
 * 카드에 뜬 숫자와 목록 총건수가 어긋나고, 그 순간 카드는 신뢰를 잃는다.
 *
 * DTO와 service 양쪽이 이 파일을 참조하므로 여기에 service를 import하지 않는다
 * (순환 참조 방지).
 */

/**
 * "진행 중"으로 보는 단계 대분류(patent_stage_group.code).
 * 정의는 docs/patent_stage_definitions.md.
 */
export const ACTIVE_STAGE_GROUPS = ["EXAM", "RESPONSE"] as const;

/**
 * "등록 대기"의 정의. 등록 결정(허여)을 받고 설정등록료 납부를 남긴 상태다.
 * 대분류 `REG` 전체가 아니라 이 세부 단계를 쓰는 이유: `REG`에는 이미 등록이 끝난
 * `REGISTERED`가 함께 들어 있어 "대기"의 뜻이 흐려진다.
 */
export const AWAITING_REGISTRATION_STAGE_CODE = "ALLOWANCE";

/**
 * 품질 조건별 Prisma where 조각. object의 key가 여러 개면 Prisma가 AND로 묶는다.
 *
 * `unmappedStatus`만 OR을 갖는데, `buildListWhere`가 이 조각을 `AND` 배열에 담으므로
 * 다른 조건의 OR을 덮어쓰지 않는다.
 */
export const PATENT_QUALITY_FILTERS = {
  /** status가 없거나, 있어도 진행 단계에 연결되지 않은 건. stages().unmapped와 같은 조건. */
  unmappedStatus: {
    OR: [{ legalStatusId: null }, { legalStatus: { stageCode: null } }],
  },
  /** 내부관리번호는 적혀 있는데 규칙에 맞지 않아 ref_* 파싱이 실패한 건. */
  refParseFailed: { internalRef: { not: null }, refOrigin: null },
  missingApplicationDate: { applicationDate: null },
  missingExpectedExpiry: { expectedExpiryDate: null },
  /** 진행 중인데 미완료 To-do가 하나도 없는 건. 방치를 잡아낸다. */
  noTodo: {
    legalStatus: { stage: { groupCode: { in: [...ACTIVE_STAGE_GROUPS] } } },
    todos: { none: { completed: false } },
  },
} as const;

export type PatentQualityFilter = keyof typeof PATENT_QUALITY_FILTERS;

export const PATENT_QUALITY_FILTER_KEYS = Object.keys(
  PATENT_QUALITY_FILTERS,
) as PatentQualityFilter[];
