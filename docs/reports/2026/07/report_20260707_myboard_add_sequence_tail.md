# MyBoard Add Sequence Tail

## 요청
- MyBoard에서 quick add 또는 add 성격의 row 추가 시 순번이 1번으로 보이지 않게 한다.
- 새 row는 대상 그룹의 마지막 row 다음 순번으로 표시되게 한다.

## 원인
- 상세 table의 `순번`은 별도 저장 필드가 아니라 현재 표시 row index로 렌더링된다.
- quick add는 `setCompoundRows((prev) => [newCompound, ...prev])`로 새 row를 맨 앞에 넣고 있었다.
- store의 `addExternalCompoundRow`도 `externalCompoundRows` 맨 앞에 넣고 있었다.
- `externalCompoundRows` 동기화 effect도 외부 row를 항상 맨 앞에 재병합해 순서를 다시 깨뜨릴 수 있었다.

## 구현
- `frontend/src/pages/MyBoard.tsx`
  - `insertCompoundsAfterGroupTail` helper를 추가했다.
  - 초기 `compoundRows` 구성과 `externalCompoundRows` 동기화 시 외부 row를 같은 group의 마지막 row 뒤에 삽입한다.
  - quick add 즉시 반영도 대상 group 마지막 row 뒤로 삽입한다.
  - copy로 추가되는 row도 대상 group 마지막 row 뒤로 삽입한다.
- `frontend/src/store/useBoardStore.ts`
  - `addExternalCompoundRow`가 같은 group의 마지막 external row 뒤에 삽입하도록 수정했다.

## 확인
- `git diff --check` 통과.
- 프로젝트 지침상 build/test 실행은 하지 않았다.
