# Office Actions 검색 키워드 하이라이트

## 작업 목적

검색 결과가 어떤 문서와 키워드 때문에 매칭되었는지 사용자가 선택 문서에서 바로 확인할 수
있게 한다. 전체 결과의 본문을 다시 받지 않고 기존 선택 문서 지연 조회와 PDF 검색 기능을
재사용한다.

## 구현 내용

- Office Actions 화면이 레일 문서 context에 마지막으로 성공한 기준 목록의 `keywords` 조건을
  함께 전달한다. 검색바에서 아직 편집 중인 미적용 조건은 사용하지 않는다.
- 통지서·의견서·보정서 timeline node에 선택 문서 지연 조회로 받은 추출 본문을 연결한다.
- 선택 OA의 각 문서 본문에서 INCLUDE condition의 모든 token이 실제 존재하는지 target별로
  확인한다. NOT 조건은 검색 근거에서 제외한다.
- 본문이 도착하면 첫 번째 실제 매칭 문서를 timeline에서 한 번만 자동 선택한다.
- timeline의 실제 매칭 문서에는 `일치` badge를 표시해 다른 target의 근거도 찾을 수 있게 한다.
- 활성 문서 위에 `검색어 일치`, 문서 종류, 매칭 token chip을 표시한다.
- 첫 token은 PDF/highlighter 준비 후 기존 PDF 전체 검색으로 자동 실행한다.
- 다른 token chip을 누르면 해당 token의 전체 하이라이트와 이전/다음 탐색으로 전환한다.
- 사용자가 PDF toolbar에 직접 검색어를 입력하면 자동 token 선택을 해제해 수동 검색을
  방해하지 않는다.
- PDF가 없는 문서는 하이라이트 대신 추출 본문에서 확인된 token chip을 표시한다.

## 성능 및 범위

- matches API payload와 응답은 변경하지 않았다.
- 목록 전체 본문·snippet·offset을 요청하거나 계산하지 않는다.
- 이미 선택 시점에 호출하던 `/patent-search/:officeActionId/content` 응답만 사용한다.
- API candidate는 ParadeDB tokenizer 기준이고 화면 근거는 선택 문서 추출 본문의 Unicode
  letter/number token 기준이다. PDF text layer가 추출 본문과 다르면 chip은 표시되지만 PDF 검색
  건수는 0일 수 있다.

## 확인

- Phase 1의 AND/OR/EXCLUDE payload와 검색 버튼 전용 API 호출 흐름은 변경하지 않았다.
- DB schema, migration, Prisma model 및 ERD 변경은 없다.
- `git diff --check`로 whitespace 오류가 없음을 확인했다.
- 저장소 지침에 따라 build와 test runner는 실행하지 않았다.
