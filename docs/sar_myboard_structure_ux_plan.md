# SAR Table / My Board 화합물 구조 UX 수정 계획

## 목표

`SarTable`의 화합물 카드 영역에서 구조 이미지 표시 세팅을 그룹별로 저장하고, 같은 그룹을 `MyBoard`와 `SynthesisBoard`의 화합물 구조 표시에서도 일관되게 반영한다. 구조 이미지 크기, 회전, 겹침 정도를 조정할 수 있게 하되, 실제 SVG 재계산/텍스트 재배치는 추후 API 연동 전까지 CSS transform 기반 preview로 처리한다.

## 공통 상태 설계

`frontend/src/store/useBoardStore.ts`에 그룹별 구조 표시 설정을 추가한다.

```ts
interface GroupStructureViewSettings {
  sarImageScalePercent: number;      // 60~130, step 5
  sarRotationDeg: number;            // 0~360, step 30
  sarOverlapPercent: number;         // 0~30, step 5
  myBoardImageScalePercent: number;  // 70~120, step 5
}

type GroupStructureViewSettingsMap = Record<string, GroupStructureViewSettings>;
```

권장 기본값:

- `sarImageScalePercent`: `100`
- `sarRotationDeg`: `0`
- `sarOverlapPercent`: `0`
- `myBoardImageScalePercent`: `120`

주의:

- 사용자가 요청한 MyBoard 기준은 “현재 기준을 120%로 설정하고, 100%로 줄여서 재표기”이므로 구현 시 현재 `CompoundStructureView width=168 height=108`를 `120% 기준`으로 해석한다.
- MyBoard slider의 표시값이 `100%`일 때 실제 렌더 크기는 현재보다 작아진다.
- 여러 그룹 선택 시 설정 UI는 빈값 표시 + disabled 처리한다.
- 단일 그룹 선택 시 해당 그룹 설정을 읽고, 변경 시 즉시 store에 저장한다.

## SAR Table 변경 계획

대상 파일:

- `frontend/src/pages/SarTable.tsx`

### 1. 이미지 크기 설정 UI 변경

현재:

- `Slider`
- `InputNumber`

변경:

- `- 버튼 | 100% input | + 버튼`
- 최소 `60%`, 최대 `130%`
- step `5%`
- 단일 그룹 선택 시만 활성화
- 여러 그룹 선택 또는 그룹 미선택 시:
  - input value는 `null` 또는 빈 문자열
  - 버튼/input disabled

예상 로직:

- `decrement`: `Math.max(60, value - 5)`
- `increment`: `Math.min(130, value + 5)`
- input 직접 입력은 5 단위로 normalize하거나 blur 시 clamp 처리

### 2. 회전 설정 UI 추가

UI:

- `좌회전 버튼(아이콘) | 0° | 우회전 버튼(아이콘)`

동작:

- 범위 `0~360`
- step `30°`
- 좌회전: `(value - step + 360) % 360`
- 우회전: `(value + step) % 360`
- 추후 API 연동 시 이 값을 API 요청 파라미터로 넘겨 SVG 자체를 재생성한다.
- 1차 구현에서는 card 내부 SVG wrapper에 `transform: rotate(...)` 적용한다.

아이콘 후보:

- `RotateCcw`
- `RotateCw`

### 3. 겹침 설정 UI 추가

UI:

- `겹침 버튼(아이콘) | 0 | 안겹침 버튼(아이콘)`

동작:

- 범위 `0~30`
- step `5`
- 단위는 `%`
- `single` view mode에서만 활성화
- `twoRows` view mode에서는 제외/disabled
- single mode의 card list에서 카드 간격을 `overlapPercent`만큼 음수 margin으로 변환한다.

예상 배치 방식:

- 현재 single mode는 `inline-flex` + `gap: SAR_COMPOUND_CARD_GAP`
- 변경 후:
  - `gap: 0`
  - 각 카드에 `marginRight: -compoundCardWidth * overlapPercent / 100`
  - 마지막 카드만 `marginRight: 0`
- 겹침이 커질수록 뒤 카드가 앞 카드 위에 보일 수 있으므로 `zIndex`를 index 기반으로 둔다.
- hover/selected card는 `zIndex`를 더 높여야 한다.

아이콘 후보:

- 겹침 증가: `Layers`
- 겹침 감소/안겹침: `Ungroup` 또는 `PanelRightOpen`

### 4. 더블 클릭 확대 팝업 삭제

현재:

- compound card `onDoubleClick`에서 `setStructurePreview(...)`
- 하단 `structurePreview` Modal 존재

변경:

- SAR Table 화합물 카드의 double click handler 제거
- 카드 확대 팝업 호출 제거
- 구조 검색 modal과 다른 preview modal 사용 여부를 분리 확인 후, SAR 카드 확대용으로만 쓰이는 modal이면 제거한다.

## My Board 변경 계획

대상 파일:

- `frontend/src/pages/MyBoard.tsx`
- `frontend/src/pages/SynthesisBoard.tsx`
- 필요 시 `frontend/src/components/common/CompoundStructureView.tsx`

### 1. SAR Table 회전 값 적용

`MyBoard`와 `SynthesisBoard` 화합물 구조 렌더링 시 record의 `groupId`로 store 설정을 조회한다.

- `rotationDeg = groupSettings[record.groupId]?.sarRotationDeg ?? 0`
- `CompoundStructureView` wrapper 또는 frame 내부 SVG wrapper에 `transform: rotate(...)` 적용

추후 API 연동 전까지는 CSS transform으로 preview만 회전한다.

SynthesisBoard 적용 대상:

- table mode의 `화합물 구조` 컬럼
- draw/card mode에서 사용하는 `CompoundStructureView`
- 기존 확대 preview modal은 별도 요청 전까지 유지한다.

### 2. MyBoard 이미지 크기 설정 UI 추가

요구 위치:

- 그룹 상세 목록
- 우측 1번 버튼
- 좌측 배치

구현 해석:

- `MyBoard` 상세 테이블 상단 toolbar에서 우측 버튼 그룹의 첫 번째 위치 근처에 배치하되, 버튼보다 왼쪽에 둔다.
- 기존 view toggle / action toolbar와 충돌하지 않게 `Space` 내부 첫 번째 컨트롤로 넣는다.

UI:

- `- 버튼 | 100% input | + 버튼`
- 범위 `70~120`
- step `5`
- 단일 그룹 선택 시 활성화
- 여러 그룹 선택 시 빈값 + disabled

렌더 기준:

- 현재 `CompoundStructureView width=168 height=108`를 `120%` 기준으로 둔다.
- 표시값 `100%`일 때:
  - `width = 168 * 100 / 120 = 140`
  - `height = 108 * 100 / 120 = 90`
- 표시값 `120%`일 때 현재와 같은 크기

### 3. 화합물 구조 컬럼 UI 정리

현재:

- `CompoundStructureView` 우측 action rail에 preview/copy 버튼 표시
- frame border/background 존재
- cell 여백은 기본 table padding

변경:

- 구조 컬럼 렌더링 시 `showPreviewAction={false}`, `showCopyAction={false}`를 기본 적용
- 대신 이미지 hover 시 overlay action 표시
  - 확대
  - 복사
- `CompoundStructureView`에 hover action overlay 옵션을 추가하는 방식 권장
  - 기존 우측 rail 동작을 유지해야 하는 다른 화면 영향 최소화
  - 예: `actionPlacement?: 'rail' | 'overlay' | 'none'`
- 구조 컬럼 frame style:
  - `borderColor: 'transparent'`
  - `background: 'transparent'`
- cell padding:
  - `.my-board-detail-table`의 structure column td에 `padding: 4px !important`
  - 상/하/좌/우 4px 이내

### 4. Hover action 설계

`CompoundStructureView` 확장안:

- 기존 props 유지
- 신규 prop:

```ts
actionPlacement?: 'rail' | 'overlay';
```

기본값:

- `rail`

MyBoard 구조 컬럼:

- `actionPlacement="overlay"`
- `showPreviewAction={true}`
- `showCopyAction={true}`

overlay style:

- 이미지 우상단 또는 하단 중앙에 작은 icon button 표시
- 기본 opacity 0
- `.compound-structure-view:hover`에서 opacity 1
- row click 선택과 충돌하지 않도록 action button click에서 `event.stopPropagation()`

## 구현 순서

1. `useBoardStore`에 그룹별 구조 표시 설정 state/action 추가
2. `SarTable` 단일 그룹 선택 여부와 현재 group setting selector 추가
3. SAR 이미지 크기 UI를 `- | input | +`로 교체
4. SAR 회전 UI 추가
5. SAR 겹침 UI 추가 및 single mode card layout에 overlap 적용
6. SAR 화합물 카드 double click 확대 제거
7. `CompoundStructureView`에 hover overlay action placement 추가
8. `MyBoard` 상세 테이블 구조 컬럼에 group setting 기반 scale/rotation 적용
9. `SynthesisBoard` table/card 구조 렌더링에 group setting 기반 rotation 적용
10. `MyBoard` 상세 toolbar에 구조 이미지 크기 UI 추가
11. MyBoard 구조 컬럼 border/background/padding 정리
12. 문서/작업 보고서 업데이트

## 검증 포인트

- SAR Table에서 단일 그룹 선택 시 설정값이 즉시 반영되는지 확인
- 여러 그룹 선택 시 설정 UI가 빈값 + disabled인지 확인
- SAR Table `2줄` 모드에서 overlap UI가 비활성화되고 레이아웃이 깨지지 않는지 확인
- 회전 적용 시 카드 clipping이 발생하지 않는지 확인
- MyBoard에서 SAR Table에서 저장한 회전 값이 같은 groupId의 구조 컬럼에 반영되는지 확인
- SynthesisBoard table/card 구조에도 SAR Table에서 저장한 회전 값이 같은 groupId 기준으로 반영되는지 확인
- MyBoard hover action이 row selection click과 충돌하지 않는지 확인
- 다크 모드에서 transparent frame이 구조 SVG 가독성을 해치지 않는지 확인

## 남은 결정 사항

- overlap 수치의 의미: 카드 폭 대비 `%`로 할지, 고정 px 기반으로 할지
- MyBoard hover overlay action 위치: 우상단 또는 하단 중앙
