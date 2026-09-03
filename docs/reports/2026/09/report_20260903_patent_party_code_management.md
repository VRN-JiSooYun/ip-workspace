# 특허 출원인·발명자 코드 관리

## 작업 목적

`특허 코드 관리` 메뉴에서 출원인과 발명자를 관리한다. 발명자는 쉼표로
묶은 문자열이 아니라 사람 한 명씩 등록하고, 특허 관리에서 등록된 여러 발명자를
다중 선택해 하나의 특허에 연결할 수 있게 한다.

## 변경 내용

- `patent_applicant`, `patent_inventor` 코드 테이블과 `patent_inventor_link` 다대다
  연결 테이블을 추가했다.
- 기존 `patent.inventors` 값은 쉼표·세미콜론·개행 등을 기준으로 개인 이름으로 분리해
  발명자 코드와 연결 행으로 이관한 뒤 기존 문자열 컬럼을 제거한다.
- 코드 관리 API의 허용 type에 `applicants`, `inventors`를 추가하고 목록·추가·수정·삭제와
  사용 건수 계산을 구현했다.
- 발명자 코드 API는 쉼표·세미콜론·개행이 든 묶음 입력을 거절해 사람 한 명 단위를
  강제한다.
- 사용 중인 코드는 기존 코드와 동일하게 삭제를 차단하며, 코드명 수정은 참조 중인 특허에
  자동 반영된다.
- 특허 코드 관리 화면에 `출원인`, `발명자` 탭을 추가했다.
- 특허 상세의 출원인은 코드 Select, 발명자는 개인 코드 다중 Select로 변경하고
  변경 이력 감사 대상에 발명자를 추가했다.
- 특허 생성·수정 API는 `inventorIds[]`를 받아 연결을 한 트랜잭션에서 교체한다.
- CSV 임포트는 발명자 셀을 개인 단위로 분리해 새 코드를 만들고 특허에 연결하며,
  CSV 다운로드는 연결된 발명자를 표시 순서대로 `, `로 합쳐 내보낸다.
- `backend/prisma/schema.prisma`, migration SQL과 `docs/patent_database_schema.md`의 ERD·표·
  제약 설명을 함께 갱신했다.

## 정합성 확인

- Prisma 관계명과 migration의 table·column·FK 이름을 대조했다.
- 발명자 이름 unique, 연결 테이블 복합 PK, FK·index·nullability·delete 정책을
  schema·migration·ERD에서 동일하게 표현했다.
- 이관 migration은 기존 발명자 원문을 분리해 개인 코드를 먼저 upsert한 뒤 연결을
  생성하므로 기존 특허와 발명자 관계가 유실되지 않는다.
- 코드 테이블·sequence 권한은 `patent_target`, 연결 테이블 권한은 `patent`에
  부여된 앱 role 권한을 복사한다.
- 기존 sequence에 명시적인 USAGE grant가 없어 최초 복사에서 누락되는 환경을 위해, 새 코드
  테이블의 INSERT 권한 보유 롤에 두 sequence의 USAGE·SELECT를 부여하는 후속 migration을
  추가했다.

## 미실행 항목

- 저장소 지침에 따라 Prisma generate, migration deploy, 테스트와 빌드는 수행하지 않았다.
