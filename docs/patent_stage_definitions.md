# 진행 현황(진행 단계) 정의

특허 관리 화면의 `진행 현황` 파이프라인이 쓰는 단계 코드의 정의와, 운영 시트의
`현재 Status`(`legal_status`)를 그 단계에 연결하는 규칙을 정리한다.

- 런타임 정본: `patent_stage` / `patent_stage_group` 테이블
- 초기값: `prisma/migrations/20260820120000_add_patent_stage/migration.sql`
- legal_status 매핑: `prisma/migrations/20260820140000_map_legal_status_stage/migration.sql`
- 앱 롤 권한: `prisma/migrations/20260820150000_grant_patent_stage_privileges/migration.sql`
- 이 문서: 왜 이렇게 나눴는지, 국가별 적용 범위, 매핑 판단 근거

## 적용 시 주의: 새 테이블 권한

마이그레이션을 소유자 롤로 적용하고 앱이 다른 롤로 접속하는 환경에서는, 새로 만든
테이블에 앱 롤 권한이 따라오지 않아 런타임에
`permission denied for table patent_stage_group`이 난다. 그래서 GRANT 마이그레이션이
기존 `legal_status`의 권한을 새 테이블에 복사한다(롤 이름을 하드코딩하지 않는다).

앞으로 만들 테이블까지 자동으로 처리하려면 DB 정책을 한 번 바꿔 두는 편이 낫다.
스키마 전체에 영향을 주는 변경이라 마이그레이션에는 넣지 않았다.

```sql
-- <migration_role>: 마이그레이션을 적용하는 롤, <app_role>: 앱 접속 롤
ALTER DEFAULT PRIVILEGES FOR ROLE <migration_role> IN SCHEMA public
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO <app_role>;
```

값을 고칠 때는 **마이그레이션(또는 코드 관리 UI)으로 DB를 고치고 이 문서를 같이
갱신한다.** 문서만 고치면 화면 집계는 바뀌지 않는다.

## 왜 상수가 아니라 테이블인가

1. `진행 현황`의 단계별 건수는 특허 목록과 **같은 모집단**을 집계해야 한다. 즉
   `legal_status`를 단계로 접어서 group by 하는 쿼리가 필요하고, 그 매핑이 코드
   상수로만 있으면 새 status 코드가 들어올 때 조용히 미분류로 빠진다.
2. CSV import가 없는 `legal_status` 코드를 자동 생성한다. 즉 코드 목록은 **운영 중에
   늘어난다.** 매핑을 DB에 두면 미매핑 코드를 쿼리로 즉시 찾을 수 있다(아래 점검 쿼리).
3. EESR·OPT-OUT처럼 특정 청(EPO/UPC)에만 있는 단계가 앞으로도 추가된다. 배포 없이
   추가할 수 있어야 한다.

## 2계층 구조 (group / stage)

상세 단계는 14개인데 파이프라인 한 줄에 다 들어가지 않는다. 진행 현황 카드 폭은
1600px 화면에서 약 968px이고, 단계 타일 최소 폭(76px)과 화살표를 감안하면 7개가 한계다.
그래서 표시용 대분류(`patent_stage_group`)와 상세 단계(`patent_stage`)를 나눈다.

- 파이프라인에는 **group**을 그린다.
- 상세 단계는 툴팁 또는 group 클릭 시 드릴다운으로 보여준다.

| group | label | 포함 단계 |
| --- | --- | --- |
| `PREP` | 출원 준비 | `FILING_PREP` |
| `FILED` | 출원 | `FILED` |
| `EXAM` | 심사 | `EXAM_REQUEST`, `EXAM_DEFER`, `EXAM` |
| `RESPONSE` | 대응 | `EESR_ISSUED`, `EESR_RESPONSE`, `OA_ISSUED`, `OA_RESPONSE` |
| `REG` | 등록 | `ALLOWANCE`, `REGISTERED` |
| `CLOSED` | 종결 | `EXPIRED`, `CLOSED` |
| `ETC` | 기타 절차 | `OPT_OUT` |

`ETC`가 따로 있는 이유는 `OPT-OUT`이 라이프사이클의 한 지점이 아니기 때문이다. UPC
관할 배제 신청은 등록 전후 모두 가능한 부가 절차라 선형 파이프라인에 끼우면 순서가
거짓말이 된다.

## 단계 정의

`scope`는 그 단계가 의미를 갖는 국가/제도를 `country.country` 코드로 적은 **표시
힌트**다. NULL은 공통이다. KR 특허만 보고 있을 때 EESR 단계가 0건으로 남는 것을 막는
용도이며, 데이터 정합성을 강제하지는 않는다.

| code | label | scope | 상세 의미 및 IP팀 업무 |
| --- | --- | --- | --- |
| `FILING_PREP` | 출원 준비 | 공통 | 명세서 작성, 번역, 발명자 검토 등 특허청 제출 전 준비 단계 |
| `FILED` | 출원 | 공통 | 관할 특허청(KIPO, USPTO, EPO 등)에 출원서 제출 완료 |
| `EXAM_REQUEST` | 심사 청구 | KR, JP | 특허청에 실체심사를 요청하는 단계 (심사청구주의 국가 대상) |
| `EXAM_DEFER` | 심사 유예 | KR | 출원인의 사정이나 전략적 이유로 심사 착수를 일정 기간 미뤄둔 상태 |
| `EXAM` | 심사 | 공통 | 특허청 심사관이 등록 가능 여부를 본격적으로 검토 중인 단계 |
| `EESR_ISSUED` | EESR 발행 | EP | 유럽특허청(EPO) 발행 확정 전 조사의견서(Extended European Search Report) 수신 상태 |
| `EESR_RESPONSE` | EESR 제출 | EP | EESR에 대한 출원인의 의견서/보정서(Response)를 EPO에 제출하는 단계 |
| `OA_ISSUED` | OA 통지 | 공통 | 심사관이 거절이유를 담은 의견제출통지서(Office Action)를 발송한 상태 |
| `OA_RESPONSE` | OA 대응 | 공통 | 거절이유 해소를 위해 특허청에 의견서 및 보정서를 작성·제출하는 단계 |
| `ALLOWANCE` | 등록 결정 | 공통 | 심사관이 거절이유가 없음을 확인하고 특허 등록 결정을 내린 상태 |
| `REGISTERED` | 등록 | 공통 | 등록 설정 등록료를 납부하여 특허권이 정식 발효된 상태 |
| `EXPIRED` | 만료 | 공통 | 존속기간(출원일로부터 보통 20년)이 다하여 권리가 자연 소멸한 상태 |
| `CLOSED` | 종결 | 공통 | 거절확정, 포기, 무효, 연차료 미납 등으로 관리가 완전 종료된 상태 |
| `OPT_OUT` | OPT-OUT | EP | 유럽통합특허법원(UPC) 관할에서 제외하고 각 개별국 법원 관할을 유지하도록 신청하는 단계 |

`ordinal`은 10칸씩 띄워 두었다. 중간 단계를 끼워 넣을 때 기존 값을 건드리지 않기 위한
것이다.

### scope 값은 IP팀 확인이 필요하다

`EXAM_REQUEST`를 `KR,JP`, `EXAM_DEFER`를 `KR`로 넣어 두었다. 심사청구·심사유예 제도의
적용 국가는 제도 변경과 실무 운영에 따라 달라질 수 있으니 IP팀 확인 후 확정한다.
`country` 테이블에 `JP` 코드가 아직 없으면 그 값은 매칭되지 않고 무시된다.

## legal_status 매핑

`legal_status.stage_code`가 매핑 컬럼이다. 운영 시트의 `현재 Status`는 자유 서술이라
값이 정제되어 있지 않다. 예제 시트에서만 봐도 `출원`, `등록`, `취하간주`,
`출원\n(File closing)`(줄바꿈 포함)이 섞여 나온다. 그래서 **문자열 규칙으로 자동
매핑하지 않고 사람이 채운다.** 자동 추론은 표기가 하나 달라질 때 조용히 틀린다.

매핑되지 않은 코드는 `NULL`로 남고, 화면에서는 `미분류`로 별도 표시해야 한다. 합계가
목록 총건수와 어긋나면 집계 전체의 신뢰를 잃기 때문에, 조용히 버리지 않는다.

### 점검 쿼리

미매핑 코드와 그 건수 — 매핑 작업의 우선순위가 된다.

```sql
SELECT ls.id, ls.status, count(p.id) AS patent_count
FROM legal_status ls
LEFT JOIN patent p ON p.legal_status = ls.id
WHERE ls.stage_code IS NULL
GROUP BY ls.id, ls.status
ORDER BY patent_count DESC, ls.status;
```

단계별 건수(파이프라인이 보여줄 값) — 미분류를 함께 드러낸다.

```sql
SELECT
    coalesce(sg.label, '미분류') AS stage_group,
    coalesce(st.label, '미분류') AS stage,
    count(p.id)                 AS patent_count
FROM patent p
LEFT JOIN legal_status ls      ON ls.id = p.legal_status
LEFT JOIN patent_stage st      ON st.code = ls.stage_code
LEFT JOIN patent_stage_group sg ON sg.code = st.group_code
GROUP BY sg.ordinal, sg.label, st.ordinal, st.label
ORDER BY sg.ordinal NULLS LAST, st.ordinal NULLS LAST;
```

### 현재 매핑 (2026-08-20 기준)

운영 DB에 있는 `legal_status`는 4종이고, 전부
`prisma/migrations/20260820140000_map_legal_status_stage/migration.sql`에서 연결했다.
미매핑은 0건이다.

| legal_status | 건수 | stage | group |
| --- | --- | --- | --- |
| `출원` | 2 | `FILED` 출원 | 출원 |
| `등록` | 2 | `REGISTERED` 등록 | 등록 |
| `취하간주` | 2 | `CLOSED` 종결 | 종결 |
| `출원 \n(File closing)` | 1 | `CLOSED` 종결 | 종결 |

**`출원 (File closing)`은 판단이 갈릴 수 있다.** 라벨은 `출원`이지만 File closing이
붙어 있고, 운영 시트의 해당 건(A22W001, PCT)은 `개별국 진입 X`로 관리가 끝나 종결로
보았다. IP팀 판단이 다르면 마이그레이션의 마지막 UPDATE 한 줄을 `FILED`로 바꾸면 된다.

이 값에는 Google Sheets 원문의 줄바꿈이 들어 있다. 그래서 매핑 SQL은 등호 비교 대신
공백을 정규화해 맞춘다. 새 코드를 매핑할 때도 같은 방식을 쓴다.

```sql
UPDATE legal_status
SET stage_code = 'OA_RESPONSE'
WHERE stage_code IS NULL
  AND regexp_replace(btrim(status), '\s+', ' ', 'g') = 'OA 대응중';
```

`stage_code IS NULL` 조건은 이미 사람이 정한 매핑을 덮어쓰지 않으려는 것이다. 덕분에
같은 마이그레이션을 다시 돌려도 0행 갱신으로 끝난다.

## 알려진 한계

1. **`출원 준비`는 현재 스키마로 표현할 수 없다.** `patent.application_number`가
   `NOT NULL UNIQUE`라 출원번호 없는 건은 특허 목록에 등록조차 되지 않는다. 이 단계
   건수는 구조적으로 0이며, 실제로 쓰려면 출원 전 건을 담는 별도 테이블이나
   `application_number` 제약 완화가 필요하다.
2. **절반은 상태가 아니라 이벤트다.** `OA 통지`, `OA 대응`, `EESR 발행`, `EESR 제출`은
   시점이 있는 사건이다. 현재 상태로 넣으면 단계별 건수는 나오지만 "OA 발행 후 경과
   일수", "대응 기한 임박" 같은 지표는 만들 수 없다. 그 정보의 정본은
   `admin` → `office_action` → `response` 이력 테이블이고, 지금은 importer가 이
   테이블을 채우지 않아 `patent.note`(화면의 '설명') 자유 서술에만 남아 있다. 이력
   적재는 별도 작업으로 다룬다.

   > 이 서술은 원래 `patent.status_note`에 있었다. 20260826120000 마이그레이션이 그
   > 값을 `patent.note`로 옮겼고, 시트의 `Status 설명` 열도 이제 `note`로 들어간다.
3. `patent`가 단계를 직접 갖지 않고 `legal_status`를 경유한다. 같은 status 코드를 쓰는
   특허는 항상 같은 단계가 된다. 특허별로 단계를 따로 지정해야 할 요구가 생기면
   `patent.stage_code`를 추가하고 `legal_status` 매핑을 fallback으로 쓰면 된다.
