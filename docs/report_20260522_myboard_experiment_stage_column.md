# My Board Experiment Stage Column Report

## 요청
- My Board 페이지 그룹 상세 목록 table에 실험 진행 과정 단계를 수치로 표시하는 `단계` 컬럼 추가.
- 컬럼 위치는 `화합물 구조` 컬럼 우측.
- 권한 등급 및 분석에 사용하는 단계값으로 볼 수 있게 mock 데이터에 값 포함.

## 구현 내용
- `frontend/src/mocks/compounds.ts`
  - `Compound` 타입에 `experimentStage?: number` 필드 추가.
  - mock compound 생성 함수와 수동 mock 데이터에 1~5 범위의 단계값 추가.
- `frontend/src/pages/MyBoard.tsx`
  - 기본 컬럼 순서에 `단계`를 `화합물 구조` 바로 뒤에 추가.
  - `allColumnsMap`에 `단계` 컬럼 추가.
  - 숫자값을 중앙 정렬하고 primary color의 bold text로 표시.

## 검증
- 프로젝트 지침상 빌드/실행은 수행하지 않음.
