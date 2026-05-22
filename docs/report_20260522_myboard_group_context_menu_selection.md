# My Board Group Context Menu Selection Report

## 요청
- My Board 페이지 그룹 리스트에서 공유 상태와 관계없이 row 우클릭 dropdown 팝업 호출.
- 우클릭한 선택 row를 기준으로 팝업을 호출하도록 수정.
- Dropdown popup 내용을 `그룹 간 통합`, `그룹 복사`, `그룹 삭제`로 구성.
- 그룹 간 통합은 선택된 목록을 통합하고 새 그룹 이름을 입력할 수 있게 구성.
- 그룹 복사는 하나의 그룹 선택시에만 가능.
- 그룹 삭제는 복수 선택 삭제가 가능하며 삭제 전 확인 메시지 호출.

## 구현 내용
- `frontend/src/pages/MyBoard.tsx`
  - 그룹 row 우클릭 시 기본 브라우저 context menu를 먼저 차단.
  - 공유 상태 조건을 제거해 모든 그룹 row에서 custom dropdown popup을 열도록 수정.
  - 우클릭한 row가 아직 선택 상태가 아니면 `toggleGroupSelection(record.id)`로 선택 상태에 포함한 뒤 popup을 호출.
  - popup의 `groupId`는 우클릭한 row의 id를 유지.
- `frontend/src/store/useBoardStore.ts`
  - `mergeGroups`, `copyGroup`, `deleteGroups` 액션 추가.
  - 통합 시 선택 그룹 count를 합산하고 새 이름을 반영.
  - 복사 시 선택 그룹을 `Copy` 이름으로 복제.
  - 삭제 시 선택 그룹 목록을 제거하고 선택 상태도 정리.
- 삭제 확인 메시지는 `총 N개의 그룹(M개의 화합물)을 삭제 하시겠습니까?` 형식으로 표시.

## 검증
- 프로젝트 지침상 빌드/실행은 수행하지 않음.
