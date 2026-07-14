# MyBoard 긴 그룹 리스트 Mock 데이터

## 요청
- My Design/MyBoard 그룹 리스트가 길어지는 상태를 확인할 수 있도록 mock 데이터를 추가한다.

## 변경
- `frontend/src/mocks/compounds.ts`
  - 스크롤 검증용으로 추가했던 임시 그룹/compound mock을 제거했다.
  - 그룹 리스트는 다시 기존 CSV 기반 그룹만 사용한다.

## 검증
- 로컬에는 Bun/npm이 없고 빌드는 사용자가 수행한다는 프로젝트 지침에 따라 빌드는 실행하지 않았다.
