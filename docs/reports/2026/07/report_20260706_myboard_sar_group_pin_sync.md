# My Board / SAR Table 좌측 구조 영역 핀 고정 연동 보고서

## 작업 내용
- My Board 그룹 리스트의 핀 고정 상태를 SAR Table 좌측 화합물 구조 영역에도 반영했다.
- My Board 그룹 리스트와 SAR Table 좌측 화합물 구조 영역은 같은 그룹 대표 구조 UX로 취급한다.
- SAR Table 좌측 화합물 구조 영역에서도 그룹 핀 버튼을 제공하며, My Board와 같은 `bookmarkedGroupIds` 상태를 토글한다.
- SAR Table 좌측 핀 버튼은 My Board 그룹 리스트의 대표 구조 핀과 같은 bookmark 아이콘, hover 노출, active 색상 UX를 사용한다.
- 핀 고정된 그룹은 SAR Table 좌측 화합물 구조 영역에서 상단 정렬하고 bookmark active 상태로 표시한다.
- My Board와 SAR Table 좌측 화합물 구조 영역 모두 먼저 핀 고정한 그룹이 더 위에 오도록 정렬한다.
- SAR Table 상단 화합물 카드 영역의 개별 compound pin UX는 My Board 그룹 핀과 연동하지 않는다.
- SAR Table 상단 화합물 카드 영역의 개별 compound pin 색상과 테이블 row highlight 색상은 초록 계열로 통일했다.
- SAR Table 좌측 화합물 구조 영역의 row 선택 UX를 My Board 그룹 리스트와 맞췄다.
- 일반 클릭은 단일 선택, `Shift + 클릭`은 anchor부터 대상 row까지 범위 선택, `Alt + 클릭`은 선택/해제 토글로 동작한다.
- 기존 호환을 위해 `Ctrl/Cmd + 클릭`도 선택/해제 토글로 유지한다.
- SAR Table 좌측 화합물 구조 영역 클릭 시에는 SAR table row 선택을 자동으로 만들지 않는다.
- SAR Table에서 table/card 영역이 아닌 곳을 클릭하면 기존 table row 선택 상태를 해제한다.
- SAR Table row와 화합물 카드에서도 `Shift + 클릭`으로 anchor부터 대상 compound까지 범위 선택할 수 있다.
- SAR Table 좌측 화합물 구조 영역 카드에 outline/overflow 보강을 적용해 하단 모서리 outline이 보이도록 조정했다.

## 상태 저장
- backend/DB 구현 전 UX 확인을 위해 `localStorage`를 임시 사용한다.
- 저장 key: `my-board:bookmarked-group-ids`

## DB 전환 시 처리
- backend/DB에 그룹 핀 고정 상태가 연결되면 `my-board:bookmarked-group-ids` localStorage 사용을 제거하거나 앱 초기화 시 삭제해야 한다.
- 서버 상태와 클라이언트 임시 상태가 충돌하지 않도록 store의 초기값 로딩 경로를 DB 응답 기준으로 변경해야 한다.
