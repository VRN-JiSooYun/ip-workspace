# My Board Idea Compound Modal UX

## Request
- My Board 그룹 상세 목록의 Add 버튼 팝업 UX를 아이디어 화합물 등록 형태로 수정.
- 타이틀, 7개 입력 라인, disabled target/group/idea number, ChemDraw, SMILES, 비고, 합성 정보, 2단 select, 출처/첨부파일/Calculations, 한 화면 레이아웃 반영.

## Implementation
- Add 버튼이 `아이디어 화합물 등록` 모달을 열도록 변경했다.
- Edit 버튼도 Add와 같은 모달 UI를 재사용하도록 변경하고, 수정 모드에서는 타이틀과 확인 버튼을 `수정`으로 표시한다.
- 수정 모드에서는 선택된 그룹 상세 row의 기존 값을 같은 폼 필드에 바인딩하고, 확인 시 새 row 생성 대신 기존 row를 갱신한다.
- 선택된 그룹의 target/group 정보를 disabled input으로 바인딩했다.
- 월별 아이디어 번호를 `LYH-YYMM-0001` 형태로 생성하는 helper를 추가했다.
  - prefix는 `LYH`로 고정한다.
  - 등록 성공 시 localStorage counter를 증가시킨다.
- 모달을 compact grid 레이아웃으로 재구성했다.
  - 1라인: 타겟, 그룹, 아이디어 번호
  - 2라인: ChemDraw 구조 영역
  - 3라인: SMILES input
  - 4라인: 디자인 비고
  - 5라인: 합성 의뢰 번호, 필요량(mg), 기대 개선 효과
  - 6라인: 합성 목적, 합성 확장필요 정도, 합성 의뢰 비고
  - 7라인: 출처/첨부파일, Calculations
- 7라인은 출처와 첨부파일을 좌측 영역에서 세로 2줄로 배치하고, Calculations는 우측 2칸을 합친 영역처럼 넓게 배치했다.
- 첨부파일 추가 시 모달 전체 높이가 늘지 않도록 첨부파일 영역 높이를 미리 확보하고 파일 목록은 내부 스크롤로 처리했다.
- 첨부파일 버튼이 출처 영역과 붙어 보이지 않도록 출처/첨부파일 행 간격과 첨부파일 영역 상단 여백을 보정했다.
- Calculations 옵션은 넓어진 영역 안에서 4열 compact grid로 표시한다.
- Calculations 라벨 영역은 `Calculations` 텍스트 아래에 `All` 토글 버튼이 오도록 세로 배치했다.
- Calculations 토글 버튼 텍스트가 세로 중앙 정렬되도록 grid 내부 토글을 flex 정렬로 보정했다.
- 합성 목적/확장필요 정도는 Ant Design Cascader 기반 2단 선택 UI로 구성했다.
- 필요량(mg)은 Patent Insight 페이지와 같은 Ant Design InputNumber 및 `patent-insight-filter-number-input` UX를 적용했다.
- 합성 목적은 1차 영역을 동시에 여러 개 선택하지 못하게 제한하고, 같은 1차 영역 안의 2차 옵션만 다중 선택 가능하도록 정규화했다.
- 합성 목적에서 자식 option이 있는 부모 option을 선택하면 부모 값 대신 모든 자식 option 값이 선택/출력되도록 조정했다.
- 합성 확장필요 정도는 `기타` 하위 항목만 다중 선택 가능하게 제한하고, 나머지 1차 옵션은 단일 선택으로 교체되도록 정규화했다.
- 등록 시 입력값을 사용해 그룹 상세 목록에 아이디어 row를 추가하도록 연결했다.
- label/control이 한 줄에 보이도록 모달 전용 compact CSS를 보강했다.
- 화합물 구조 라벨을 제외한 모달 라벨은 우측 정렬로 맞췄다.
- 라벨 영역은 동일 폭을 유지하되 폭과 label/value gap을 줄이고, 필드 간 gutter를 넓혀 다음 라벨 영역과의 구분을 개선했다.
- 화합물 구조 라벨은 ChemDraw 위쪽에 배치해 구조 편집 영역이 한 줄 전체 폭을 쓰도록 조정했다.
- 모달 최대 폭을 넓히고 body 가로 overflow를 숨겨 팝업 내부 가로 스크롤이 생기지 않도록 조정했다.
- 모달 body 스크롤바가 라이트/다크 모드 theme token을 따르도록 추가했다.
- 모달 내 Select/Cascader popup 스크롤바도 라이트/다크 모드 theme token을 따르도록 popup class와 전용 CSS를 추가했다.

## Verification
- 빌드/실행은 프로젝트 지침에 따라 수행하지 않았다.
- `git diff --check`로 패치 공백 오류를 확인했다.
