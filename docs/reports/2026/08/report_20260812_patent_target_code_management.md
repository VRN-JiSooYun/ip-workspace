# 특허 Target 코드 관리 구현 보고서

## 작업 목적

`특허 코드 관리` 메뉴에서 Target을 국가·대리인·법적 상태·심사 상태와 같은 방식으로 추가, 변경, 삭제하고 사용 건수를 확인할 수 있게 한다. 관리 특허의 Target 입력과 필터가 관리 코드만 사용하도록 DB 무결성을 함께 보장한다.

## 변경 내용

### DB Schema 및 migration

- `patent_target` 코드 테이블을 추가했다.
  - `id`: autoincrement PK
  - `target`: unique 코드명
- 기존 `patent.target` 문자열 컬럼은 유지하고 `patent_target.target`을 참조하는 nullable FK로 변경했다.
  - 이름 변경: `ON UPDATE CASCADE`
  - 코드 삭제: `ON DELETE SET NULL` (애플리케이션은 사용 중 삭제를 사전에 차단)
- `patent.target` 조회를 위한 index를 추가했다.
- migration은 기존 `patent.target` 값을 distinct 이관한다. 공백뿐인 기존 값은 `NULL`로 정리한다.

### Backend 코드 관리 API

- `PATENT_CODE_TYPES`에 `targets`를 추가했다.
- 기존 공통 API로 Target CRUD를 지원한다.
  - `GET /api/patent-codes/targets`
  - `POST /api/patent-codes/targets`
  - `PATCH /api/patent-codes/targets/:id`
  - `DELETE /api/patent-codes/targets/:id`
- Target 이름 중복을 `PATENT_TARGET_DUPLICATED`로 거부한다.
- 사용 중인 Target은 다른 특허 코드와 같은 `PATENT_CODE_IN_USE:<count>` 정책으로 삭제를 막는다.
- Target 이름 변경 시 DB FK cascade로 연결된 모든 `patent.target` 값이 함께 변경된다.

### 관리 특허 및 CSV 연동

- 관리 특허 lookup 응답에 Target 코드 목록을 추가했다.
- 관리 특허 추가·수정 DTO가 Target을 받고, 등록된 Target인지 검증한 뒤 저장한다.
- 관리 특허 추가·수정 modal에 Target Select를 추가했다.
- CSV import에서 Target 코드를 함께 해석한다.
  - 이미 등록된 Target은 대소문자 무시 비교 후 등록된 표기를 사용한다.
  - 새로운 Target은 DRY_RUN의 `newCodes.targets`에 표시한다.
  - APPLY transaction에서 Target 코드를 먼저 만든 뒤 특허를 저장한다.
- 특허 관리 화면의 Target 필터 목록은 `patent_target` 전체를 사용하므로 아직 사용되지 않은 신규 코드도 0건으로 표시한다.

### Frontend 코드 관리 UI

- `특허 코드 관리`에 `Target` 탭을 추가했다.
- Target 추가, inline 이름 변경, 사용 건수 표시, 미사용 코드 삭제를 기존 공통 UI로 제공한다.
- 중복 Target 오류를 사용자 문장으로 변환한다.

## Schema·Migration·ERD 정합성

- Prisma: `PatentTarget` model, `Patent.targetCode` relation, `Patent.target` index 반영
- Migration: 기존 Target 이관, unique/index/FK와 update/delete 정책 반영
- ERD: `patent_target ||--o{ patent` 관계와 table/column/제약 설명 반영
- 세 항목에서 table명 `patent_target`, 참조 column `target`, nullable 및 cascade 정책이 일치함을 정적으로 확인했다.

## 검증 결과

- 변경 파일에 대해 `git diff --check`를 통과했다.
- 백엔드와 프론트엔드의 코드 type 값이 모두 `targets`로 일치함을 확인했다.
- 코드 CRUD, lookup, 관리 특허 저장, Target 필터, CSV import가 같은 `patent_target` 원본을 사용하도록 연결된 것을 정적으로 확인했다.
- migration 순서상 기존 `patent.target` column 추가 이후 Target 코드 migration이 적용됨을 확인했다.
- 관련 파일 외 사용자의 기존 변경은 수정하지 않았다.

## 미실행 항목

- 저장소 지침에 따라 Prisma migration 실행, Prisma client 생성, 빌드, 테스트, 개발 서버 실행은 수행하지 않았다.
- 사용자는 실행 환경에서 migration을 적용한 후 기존 Target 이관 결과와 CRUD UI를 확인해야 한다.
