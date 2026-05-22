# Compound Structure Common Component Report

## 요청
- 모든 페이지의 화합물 구조 UI를 My Board 페이지의 구조 UI 기준으로 공통 Component화.
- 구조 버튼은 특허 분석 상세 페이지처럼 늘어날 수 있는 형태로 구성.

## 구현 내용
- `frontend/src/components/common/CompoundStructureView.tsx` 공통 컴포넌트 추가.
- 구조 SVG 프레임과 우측 액션 레일을 공통화.
- 기본 액션으로 `크게 보기`, `구조 데이터 복사`를 제공.
- `actions` props로 페이지별 추가 버튼을 확장할 수 있도록 구성.
- 복사 우선순위는 `smiles` → `molBlock/mol_block/molblock` → `svg`.
- 액션 버튼 순서는 `크게 보기` → `구조 데이터 복사` → `ChemDraw` 기준으로 통일.
- `frameStyle`, `frameClassName`, `svgClassName` 등으로 페이지별 프레임 스타일 차이를 흡수할 수 있도록 처리.
- `CompoundStructureView` wrapper는 `inline-flex` 대신 `flex` 기반으로 변경하고, `fullWidth` 옵션으로 카드형 구조 이미지를 전체 폭 기준 중앙 정렬할 수 있도록 보정.
- 공통 CSS를 `frontend/src/index.css`에 추가해 SVG fit, 액션 레일, row hover/selected 상태 UX를 통일.

## 적용 범위
- `frontend/src/pages/MyBoard.tsx`
  - 그룹 리스트 대표 구조 컬럼
  - 그룹 상세 목록 `화합물 구조` 컬럼
- `frontend/src/pages/SynthesisBoard.tsx`
  - 합성 상세 목록 `화합물 구조` 컬럼
  - Canvas 카드 구조 영역
- `frontend/src/pages/SarTable.tsx`
  - 상단 화합물 카드 구조 영역
- `frontend/src/components/patent-analysis/DataCardItem.tsx`
  - 특허 분석 상세 Raw Data/Summary 카드형 SVG 구조 영역
  - Raw Data 카드형 SVG는 액션 레일이 있어도 구조 이미지가 중앙 정렬되도록 조정
- `frontend/src/pages/PatentAnalysisDetail.tsx`
  - Scaffold Ranking, Functional Group, Raw Data 테이블 내부 SVG 액션 버튼 레일
  - 테이블 내부 SVG 프레임은 액션 레일 폭만큼 이미지 영역을 줄여 버튼과 구조 이미지가 겹치지 않도록 처리
  - `raw-data-svg-frame` 내부 SVG가 좌측으로 밀리지 않도록 SVG 렌더 프레임은 전체 폭 기준 중앙 정렬을 유지하도록 보정
  - 특허 상세 내부 SVG 렌더러의 기본 padding을 제거하고, SVG가 부모 프레임의 width/height를 채우도록 조정
  - Functional Group의 Scaffold Rank 1 구조 프레임 padding을 제거해 구조 이미지가 더 크게 보이도록 조정
- MyBoard, SynthesisBoard, SAR Table, PatentAnalysisDetail의 구조 미리보기 modal에서 SVG를 약 1.5배 확대해 표시하도록 조정
- 확대된 SVG가 modal preview frame 밖으로 잘리지 않도록 preview modal 폭/높이를 확장하고, 확대 전 SVG 기준 크기를 제한해 확대 후에도 프레임 안에 들어오도록 보정

## 참고
- 특허 분석 상세 페이지의 ChemDraw, preview, pagination 동작은 유지.
- SVG가 아닌 table image/base64 preview는 기존 미리보기 버튼 UX를 유지.

## 검증
- 프로젝트 지침상 빌드/실행은 수행하지 않음.
