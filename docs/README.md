# 문서 안내

이 파일은 `docs/`의 진입점이다. 에이전트와 개발자는 전체 파일을 순서대로 읽지 않고, 아래 분류와 검색 명령으로 필요한 문서만 찾는다.

## 먼저 읽을 문서

- `frontend_spec.md`: 프론트엔드 기술 스택과 기본 설계 방향
- `UI_STANDARD_GUIDE.md`: 공통 UI 기준
- `auth_database_schema.md`: PostgreSQL 14·Prisma 인증 및 비동기 계산 ERD와 데이터 보안 기준
- `oa_database.md`: 외부 OA PostgreSQL 연결, lookup API와 로컬 DB 분리 기준
- `seaweedfs_storage.md`: Quill 설명 이미지의 SeaweedFS 저장 경로와 업로드 API
- `task.md`: 초기~중기 구현 체크리스트와 완료 현황
- `walkthrough.md`: 주요 구현 결과 요약

## 디렉토리 구조

```text
docs/
├── README.md
├── reports/YYYY/MM/report_YYYYMMDD_<topic>.md
├── plans/YYYY/MM/plan_YYYYMMDD_<topic>.md
├── *_plan.md, *_guide.md, *_analysis.md
└── API 스키마·다이어그램·기타 장기 참고 문서
```

- `reports/`: 완료된 작업과 검증 결과. 연/월까지만 폴더로 나누고 정확한 날짜와 주제는 파일명에 둔다.
- `plans/`: 날짜 기반 실행 계획. 완료 후에도 당시 판단 근거로 보존한다.
- 루트의 `*_plan.md`, `*_guide.md`, `*_analysis.md`: 날짜에 종속되지 않는 장기 기준·설계 문서다.
- 요일별 또는 일자별 폴더는 만들지 않는다. 폴더가 지나치게 깊어지고 주제 검색이 어려워진다.

## 에이전트 탐색 순서

1. 현재 작업의 코드와 `AGENTS.md`를 확인한다.
2. 장기 기준이 필요하면 이 문서의 “먼저 읽을 문서”와 루트의 관련 설계 문서를 확인한다.
3. 과거 구현 근거는 `reports/`에서 기능명, 페이지명, 컴포넌트명으로 검색한다.
4. 진행 전 계획이나 보류된 판단은 `plans/`에서 검색한다.
5. 날짜만 알고 있다면 해당 `YYYY/MM` 폴더만 조회한다.

권장 검색 예시:

```bash
rg -n "CompoundStructureView|parent overlay" docs/reports docs/plans
rg --files docs/reports/2026/07 | sort
rg -n "MyBoard|SynthesisBoard" docs
```

## 새 문서 작성 규칙

- 작업 보고서: `docs/reports/YYYY/MM/report_YYYYMMDD_<topic>.md`
- 날짜 기반 계획: `docs/plans/YYYY/MM/plan_YYYYMMDD_<topic>.md`
- 장기 기준 문서: `docs/<domain>_<purpose>.md`
- `<topic>`은 영문 소문자 `snake_case`로 작성한다.
- 한 작업은 가능한 한 하나의 보고서로 작성한다. 서로 독립적인 변경만 파일을 분리한다.
- 제목, 작업 목적, 변경 내용, 검증 결과, 미실행 항목을 포함한다.
- 문서 경로를 링크할 때는 이동에 취약한 절대 경로보다 현재 문서 기준 상대 링크를 우선한다.

## 보관 원칙

- 같은 날의 보고서를 강제로 합치지 않는다. 독립적인 작업 단위와 검색 가능한 주제를 보존한다.
- 월이 바뀌면 새 월 폴더만 추가한다.
- 오래된 보고서는 삭제하지 않고 연/월 경로에 유지한다.
- 월별 요약은 실제로 회고가 필요할 때만 `summary_YYYYMM.md`로 추가한다.
- `.DS_Store` 같은 운영체제 메타 파일은 문서로 취급하지 않는다.
