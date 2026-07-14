# MyBoard 그룹 상세 테이블 컬럼 정렬

## 작업 범위
- `frontend/src/pages/MyBoard.tsx`의 그룹 상세 테이블 컬럼 정렬 규칙을 조정했다.
- 긴 텍스트가 표시될 수 있는 multiline 컬럼은 기존 좌측 정렬 흐름을 유지했다.
- 나머지 상세 테이블 컬럼은 공통 상세 테이블 래퍼에서 `align: 'center'`와 `table-center-column` 클래스를 적용하도록 분리했다.

## 구현 내용
- 기존 `withMyBoardHeaderCell`은 그룹 목록 테이블과 상세 테이블에서 함께 사용되고 있어 그룹 목록 정렬에 영향이 가지 않도록 유지했다.
- 상세 테이블 전용 `withMyBoardDetailHeaderCell`을 추가했다.
- `MYBOARD_MULTILINE_TEXT_COLUMN_KEYS`에 포함된 컬럼을 제외한 상세 테이블 컬럼을 중앙정렬 대상으로 처리했다.

## 확인 사항
- 로컬 빌드 및 실행은 프로젝트 지침에 따라 수행하지 않았다.
