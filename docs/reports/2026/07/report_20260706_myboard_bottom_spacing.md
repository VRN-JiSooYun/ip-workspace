# MyBoard 리스트 하단 간격 UX 패치

## 요청
- My Design 페이지에서 그룹 리스트와 그룹 상세 목록의 데이터가 많아질 때, 리스트 영역이 페이지 하단과 16px 정도의 간격으로 끝나도록 조정.

## 변경
- `frontend/src/pages/MyBoard.tsx`
  - 그룹 리스트 Table에 데스크톱 전용 세로 스크롤 최대 높이를 추가했다.
  - 그룹 상세 목록 Table의 기존 고정 스크롤 높이(`calc(100vh - 430px)`)를 화면 하단 기준에 맞춘 값으로 조정했다.
  - 리스트 카드 자체는 데이터가 적을 때 콘텐츠 높이에 맞게 유지하고, 데이터가 많을 때만 Table body가 스크롤되도록 했다.
  - MyBoard 페이지 자체는 부모 Content 높이 안에서 overflow를 막고, 긴 목록은 Table body 스크롤만 생기도록 했다.
  - 그룹 리스트 구조-only 모드도 데이터가 많을 때 Table body 스크롤을 사용하도록 맞췄다.
  - 그룹 상세 목록 pagination이 잘리지 않도록, Table body의 실제 화면 위치와 pagination 높이를 측정해 세로 스크롤 높이를 동적으로 계산하도록 변경했다.
  - 그룹 상세 목록이 최대 높이까지 길어질 때 pagination 하단 라인과 카드 border가 잘리지 않도록 하단 2px 여유를 추가했다.
  - 그룹 리스트가 최대 높이까지 길어질 때 카드 하단 라인이 잘리지 않도록 그룹 리스트 body에도 하단 2px 여유를 추가했다.
  - 그룹 리스트에 세로 스크롤이 생기면서 불필요한 가로 스크롤이 기본 표시되지 않도록, 패널 폭이 충분할 때는 `scroll.x`를 비활성화하고 horizontal overflow를 숨겼다.
  - 그룹 리스트 데이터가 적어 세로 스크롤이 필요 없을 때는 `scroll.y`를 비활성화해 빈 body 영역과 잘린 row highlight가 생기지 않도록 했다.
  - 모바일/좁은 화면에서는 기존 페이지 스크롤 흐름을 유지하도록 1100px 이하에서 높이 고정을 해제했다.
- `frontend/src/components/layout/MainLayout.tsx`
  - 모든 화면의 Content 하단 padding을 `24px`에서 `16px`로 공통화했다.

## 검증
- 로컬에는 Bun/npm이 없고 빌드는 사용자가 수행한다는 프로젝트 지침에 따라 빌드는 실행하지 않았다.
