# SAR Table Group Structure Panel Report

## 요청
- SAR Table 페이지 좌측에 My Board 그룹 리스트의 `화합물 구조만 보기` 상태를 추가.
- 기존 SAR 화합물 구조 영역과 SAR table은 우측 영역에 배치.
- My Board에서 선택된 그룹 구조 선택 상태를 그대로 유지하고, SAR Table에서도 같은 방식으로 선택/해제 가능하게 데이터 연동.

## 구현 내용
- `frontend/src/pages/SarTable.tsx`에서 `useBoardStore`의 `groups`, `selectedGroupIds`, `toggleGroupSelection`, `setSelectedSarCompoundIds`를 사용하도록 확장.
- 좌측 `sar-group-structure-card` 영역을 추가하고, 그룹별 대표 화합물 구조만 표시하는 compact table 구성.
- 좌측 그룹 영역 헤더의 타이틀 텍스트를 제거하고, 그룹 panel 전체를 접고 펼칠 수 있는 버튼을 추가.
- 그룹 접기/펼치기 버튼 아이콘을 My Board 그룹 리스트와 같은 `PanelLeftClose`/`PanelLeftOpen` 기준으로 변경.
- 그룹 panel을 완전 접었을 때 좌측 panel 폭을 남기지 않고, 우측 화합물 영역 타이틀 왼쪽에 펼치기 버튼을 노출하도록 조정.
- 좌측 그룹 구조 table의 컬럼/패널 폭을 넓히고 X축 overflow를 숨겨 가로 스크롤이 생기지 않도록 조정.
- SAR Table 좌측 그룹 구조 영역을 My Board의 화합물 구조만 보기 상태에 맞춰 card 폭 128px, 컬럼 폭 122px, header 텍스트 `#495057`, table/card 사이 여백 0, 기본 Y축 스크롤 없음으로 조정.
- SAR table 전역 첫 번째 header 색상 규칙보다 뒤에서 그룹 구조 table header 색상을 다시 지정해 `#495057`이 실제 적용되도록 보정.
- `.sar-group-structure-table .ant-table`의 중앙 정렬 margin을 제거하고 table 폭을 100%로 조정해 그룹 영역과 테이블 사이 여백을 제거.
- 좌측 그룹 row 클릭 시 My Board와 동일한 `toggleGroupSelection`을 호출.
- 선택 그룹 변경 시 `selectedSarCompoundIds`도 선택 그룹의 화합물 id 목록으로 갱신해 기존 SAR 데이터 흐름과 연결.
- 우측 SAR 화합물 카드 영역과 SAR table은 선택된 그룹의 화합물만 표시하도록 변경.
- 선택 그룹이 모두 해제되면 우측 SAR 데이터도 비어 보이도록 처리.
- 우측 SAR content 영역에 오른쪽 여백을 추가해 테이블/카드가 화면 끝에 붙지 않도록 조정.
- 우측 화합물 구조 영역 타이틀에 접기/펼치기 버튼을 추가하고, 접힌 상태에서는 구조 카드 리스트와 보기 옵션을 숨기도록 조정.
- 우측 화합물 구조 영역의 타이틀 텍스트를 제거.
- 화합물 구조 카드 리스트를 가로 스크롤형 배치에서 auto-fill grid 배치로 변경해 영역 폭 안에서 줄바꿈되도록 조정.
- 좁은 화면에서는 좌측 그룹 구조 panel과 우측 SAR content가 세로로 쌓이도록 responsive CSS 추가.

## 검증
- 프로젝트 지침상 빌드/실행은 수행하지 않음.
