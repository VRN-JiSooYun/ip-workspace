# Reaction Predictor UI/UX 구현 계획

## 목표

`docs/prototype/reaction_predictor.png` 스케치를 기반으로 `Reaction Predictor / OA` 신규 메뉴 화면을 추가한다. 화면은 기존 프로젝트의 `MainLayout`, breadcrumb, Ant Design, 공통 CSS 유틸리티(`v-table-card`, `v-table-header`, `v-search-input`, `v-action-btn`, `c-card`)를 그대로 따르고, Mock 데이터 기반의 UI 우선 구현으로 진행한다.

## 메뉴 및 라우팅

- 신규 메뉴명: `Reaction Predictor`
- 권장 위치: 좌측 사이드바의 `Compounds` 하위 메뉴
  - 현재 스케치도 My Workspace 하위 실험/화합물 업무 흐름에 가깝다.
  - `My board`, `Chemical space`와 같은 compound workflow로 묶는 것이 자연스럽다.
- 권장 라우트: `/reaction-predictor`
- breadcrumb: `Compounds / Reaction Predictor`
- 페이지 컴포넌트: `frontend/src/pages/ReactionPredictor.tsx`

## 화면 IA

### 1. 상단 검색/필터 바

기존 `MyBoard`의 compact filter card 패턴을 사용한다.

- 좌측: 검색 입력
  - placeholder: `Search by SMILES or Name`
  - class: `v-search-input`
  - prefix icon: `Search`
- 우측 액션:
  - `상세 필터 열기`
  - `구조 검색`
- 반응 타입 탭:
  - `Oxidative Addition (OA)`
  - `SNAr`
  - 이후 확장 가능한 segmented/tab 형태
- 선택된 반응 타입은 강조색을 과하게 쓰지 않고, 기존 coral primary와 얇은 border를 사용한다.

### 2. Home / Recent calculations

스케치의 메인 테이블은 기존 `v-table-card` + Ant Design `Table`로 구현한다.

컬럼 초안:

- `Name`
- `Molecule`
- `Major site`
- `ΔΔG‡ (kJ/mol)`
- `Status`
- `Start Date`
- `End Date`
- row action: 상세 보기 또는 report 열기

우측 상단 primary action:

- `Add prediction`
- class: `v-action-btn`
- icon: `Plus` 또는 `Sparkles`
- 클릭 시 prediction modal open

상태 표현:

- `Completed`: 작은 green status tag
- `Calculating`: neutral/progress tag
- `Failed`: red/orange tag

### 3. Add prediction modal

스케치의 큰 팝업은 Ant Design `Modal`을 사용하되, 기존 ChemDraw modal 톤에 맞춘다.

구성:

- title: `Prediction`
- width: 약 `920px`에서 시작, 화면 폭에 따라 `calc(100vw - 48px)` 제한
- body grid:
  - 좌측: `Structure Input`
    - ChemDraw editor 또는 현재 사용 중인 `ChemDrawModal`/`ChemDrawEditor` 재사용 검토
    - 구조 이름 input: `Name`
  - 우측: `Detected C-X Sites`
    - site table: `Site`, `LG`, `Use`
    - `Use`는 checkbox
    - domain check alert
    - `Run ΔG‡OA prediction` primary button

동작:

- 사용자가 구조 입력 후 C-X site 후보를 확인한다.
- 기본적으로 domain check를 통과한 site만 선택한다.
- prediction 실행 시 modal 내 loading 상태로 전환하거나, 완료 후 결과 상세 패널로 이동한다.

### 4. Prediction result view

스케치의 우측 카드(`ΔΔG‡ Profile`, `Why C5-Br wins`, Confidence Report`)는 테이블 row 선택 또는 실행 완료 후 우측 결과 패널로 보여준다.

권장 레이아웃:

- 데스크톱:
  - 좌측 65%: recent calculations table
  - 우측 35%: selected result summary
- 좁은 화면:
  - table 아래에 result summary를 세로 배치

결과 패널 구성:

- `ΔΔG‡ Profile`
  - molecule SVG preview
  - site별 energy badge
  - major/minor legend
- `Why C5-Br wins`
  - factor별 contribution bar
  - `ESP`, `Steric`, `LG term` 등
- `Confidence Report`
  - confidence score card
  - pass/review/fail checklist
  - 상세 report modal open 버튼

## 스타일 가이드

### 공통 클래스 사용

- 페이지 외곽:
  - `useResponsiveLayout()` 또는 `getPatentAnalysisLayoutPreset()` 패턴 사용
  - `maxWidth`, `sidePadding` 일관 적용
- 검색/액션:
  - `.v-search-input`
  - `.v-action-btn`
- 카드:
  - `.v-table-card`
  - `.v-table-header`
  - `.c-card`

### 신규 CSS 권장 클래스

`frontend/src/index.css`에 페이지 전용 최소 클래스만 추가한다.

- `.reaction-predictor-page`
- `.reaction-type-tabs`
- `.reaction-result-panel`
- `.reaction-molecule-preview`
- `.reaction-confidence-score`
- `.reaction-factor-row`

색상은 신규 팔레트를 만들지 않고 CSS variable과 Ant Design token을 우선 사용한다.

- 배경: `var(--bg-color)`
- 카드: `var(--card-bg)`
- border: `var(--c-card-border)`
- 주요 강조: `#F87C63`
- 보조 성공: Ant Design green 계열 또는 낮은 채도의 mint background

### 시각 톤

- 스케치의 큰 둥근 팝업 느낌은 유지하되, 실제 앱에서는 카드 radius를 기존 기준인 12px 중심으로 맞춘다.
- 화면 전체를 marketing-style hero처럼 만들지 않고, 업무용 tool 화면처럼 조밀하고 스캔하기 쉽게 구성한다.
- molecule/result 카드는 반복 정보 카드로만 사용하고, 페이지 section 자체를 과도한 floating card로 만들지 않는다.

## 데이터 모델 초안

```ts
interface ReactionPredictionRow {
  id: string;
  name: string;
  smiles: string;
  moleculeSvg?: string;
  reactionType: 'oa' | 'snar';
  majorSite: string;
  leavingGroup: string;
  deltaDeltaG: number | null;
  status: 'completed' | 'calculating' | 'failed';
  startDate: string;
  endDate?: string;
  sites: ReactionSite[];
  confidence?: ConfidenceReport;
  factors?: ReactionFactor[];
}

interface ReactionSite {
  site: string;
  leavingGroup: string;
  enabled: boolean;
  deltaG?: number;
}

interface ConfidenceReport {
  score: number;
  verdict: 'high' | 'medium' | 'low';
  checks: Array<{
    label: string;
    status: 'pass' | 'review' | 'fail';
    detail: string;
  }>;
}
```

## 구현 순서

1. `ReactionPredictor.tsx` 페이지 추가
2. Mock 데이터 추가
   - `frontend/src/mocks/reactionPredictions.ts`
3. `App.tsx` 라우트 추가
4. `MainLayout.tsx` 사이드바 메뉴 추가
5. 페이지 상단 검색/반응 타입 탭/테이블 구현
6. `Add prediction` modal 구현
7. 선택 row 기반 결과 요약 패널 구현
8. 반응형 레이아웃 및 dark mode 확인

## 확인 포인트

- `Compounds` 하위 메뉴에 추가하는 것이 실제 서비스 메뉴 구조와 맞는지 확인 필요
- ChemDraw 입력은 기존 `ChemDrawEditor`를 modal body에 직접 embed할지, 단순 preview/mock으로 먼저 갈지 결정 필요
- 실제 backend API가 없으므로 1차 구현은 Mock 데이터와 UI 상태 기반으로 진행
- 추후 API 연동 시 prediction 실행 상태(`calculating`)와 polling UX가 필요
