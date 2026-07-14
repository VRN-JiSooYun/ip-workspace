# RDKit Draw 설정 팝업 연결 보고서

## 작업 내용
- 화면 상단 헤더의 팔레트 아이콘 버튼에 `RDKit Draw 설정` 팝업 호출 동작을 연결했다.
- 공통 컴포넌트 `RdkitDrawOptionsModal`을 추가했다.
- 대표 SMILES를 기준으로 옵션 변경 시 `/rdkit-api/draw` preview를 debounce 호출한다.
- 저장 시 `localStorage` key `voronoi:rdkit-draw-options:v1`에 옵션을 저장한다.
- `기본값으로 되돌리기` 버튼으로 저장값을 제거하고 기본 옵션으로 복원한다.

## 현재 반영 옵션
- `atomLabelBlock`
- `abbrev_option`
- `transparent_bg`
- `fixed_bond_length`
- `font_size`
- `fixed_font_size`
- `line_width`
- `padding`
- `additionalAtomLabelPadding`
- `multipleBondOffset`
- `max_abbrev_coverage`
- `kekulize`
- `boldfont`
- `addStereoAnnotation`

## 후속 작업
- 저장된 옵션을 `structureRendering.ts`의 `/draw`, `/cluster_v1` 요청과 Whiteboard의 직접 `/draw` 호출부에 공통 적용했다.
- cache key에 전역 draw option 값을 포함해 옵션 변경 후 이전 SVG cache가 재사용되지 않도록 했다.
- SAR table의 화합물 카드 영역은 기존 카드 전용 UX 옵션을 유지해야 하므로 전역 draw option 적용 대상에서 제외했다.
- 저장/리셋 시 `voronoi:rdkit-draw-options-changed` 이벤트를 발행하고, 전역 옵션을 사용하는 구조 뷰가 이를 구독해 페이지 새로고침 없이 즉시 재렌더링되도록 했다.

## 적용 제외
- `SarTable` 화합물 카드 구조 렌더링
- `SarTable` 화합물 카드의 scaffold/highlight cluster 렌더링

## SAR Table 화합물 카드 처리
- SAR table 화합물 카드 영역은 전역 RDKit draw option을 사용하지 않고, 화합물 영역의 `Atom`, `Abbreviation`, `Highlight`, `Scaffold` 버튼 옵션을 우선한다.
- SAR table 화합물 카드 영역의 `Atom`, `Abbreviation`, `Highlight`, `Scaffold` 버튼 옵션도 `Scale`, `Rotate`, `Overlap`과 동일하게 `groupStructureViewSettings`에 저장한다.
- 그룹을 다시 선택해도 저장된 화합물 카드 옵션을 유지하고, 그룹별 구조 표시 설정과 동일한 흐름으로 렌더링한다.
- SMILES 기반 카드 렌더링 후 내부 MOL block이 생성되더라도 카드 cache key는 입력 source(`molBlock` 또는 `SMILES`) 기준으로 유지해, 버튼 옵션 변경 시 새 SVG가 정상 로드되도록 했다.
- RDKit 요청과 화면 cache key가 서로 다른 source 기준을 쓰지 않도록 `getRdkitStructureSourceKey`를 공통화했다. 유효한 molblock이면 molblock, 아니면 SMILES key를 사용한다.
- 그룹 클릭 시 남아 있는 검색어가 해당 그룹 결과를 모두 제거하는 경우에는 검색어를 초기화해 화합물 카드 영역이 빈 상태로 남지 않도록 했다.
- SAR 카드처럼 전역 draw option을 제외한 렌더링에서도 `renderRdkitSvg()` 내부 cache key 생성 시 `useGlobalDrawOptions: false`를 유지하도록 수정했다. 이 값이 누락되면 API가 SVG를 반환해도 화면이 기대하는 key와 응답 key가 달라져 기본 SVG만 보일 수 있다.
