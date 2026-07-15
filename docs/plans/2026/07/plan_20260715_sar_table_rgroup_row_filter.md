# SAR Table Core/R-group Row 상세 필터 UX 작업 계획

## 작업일

- 예정일: 2026.07.15
- 대상 페이지: SAR Table
- 주요 파일: `frontend/src/pages/SarTable.tsx`
- API 변경: 없음

## 배경

현재 `cluster_v1` 응답의 `Core`, `R1`, `R2`, `Rn...` 구조를 화합물 카드 하단에 표시하고 있다. 화합물마다 R-group 개수가 달라 카드 높이가 달라지고, 카드 영역에서 구조와 R-group을 함께 비교해야 해서 시각적 밀도가 높다.

Core/R-group은 개별 카드의 부가 정보보다 하단 SAR Table의 행별 비교 정보에 가깝다는 의견을 반영해 다음과 같이 UX를 변경한다.

- 화합물 카드에서는 Core/R-group 목록을 제거한다.
- Table Toolbar의 Color scale 버튼 우측에 Core/R-group 표시 필터를 제공한다.
- 선택한 Core/R-group은 각 최상위 화합물 row 바로 아래 상세 영역에 표시한다.

## 현재 구현 확인

- `renderRdkitClusterSvgs()`가 `cluster_v1`을 호출한다.
- 응답의 `Core`, `R1`, `R2`, `Rn...`는 `RdkitClusterRGroup`으로 변환된다.
- SAR Table은 결과를 `clusterRGroupsByCompoundId`에 다음 형태로 보관한다.

```ts
Record<string, Record<string, RdkitClusterRGroup>>
```

- 각 R-group 값에는 `smiles`, `svg`가 포함된다.
- 현재 화합물 카드의 `.sar-compound-rgroup-list`가 이 데이터를 직접 렌더링한다.
- 하단 Table에는 이미 복수 SAR API 결과를 표시하기 위한 `children` row가 있으므로 R-group 상세 UX가 기존 하위 assay row와 충돌하지 않게 해야 한다.

## 확정 UX

### Toolbar 필터

Color scale 버튼 우측에 현재 cluster 응답에 존재하는 key만큼 toggle 버튼을 생성한다.

```text
[Color scale] [Core] [R1] [R2] [R3] ...
```

- key 순서는 `Core`, `R1`, `R2`, ..., `Rn`의 자연 정렬을 사용한다.
- 여러 버튼을 동시에 선택할 수 있다.
- 초기 상태는 모두 미선택이며 기존 Table 높이를 유지한다.
- 선택 버튼은 primary 계열 활성화 색상으로 표시한다.
- 이 기능에서 필터는 Table row 자체를 제거하는 조건 필터가 아니라, row 상세 영역에 표시할 R-group 종류를 선택하는 display filter를 의미한다.
- Highlight가 `Off`이거나 cluster 응답이 없으면 버튼을 숨긴다.
- cluster 요청 중에는 기존 버튼을 disabled 처리하거나 로딩 상태를 표시한다.
- 그룹 또는 cluster 결과가 변경되면 더 이상 존재하지 않는 선택 key를 자동으로 제거한다.
- key가 많아 Toolbar 폭을 넘으면 줄바꿈 또는 가로 스크롤을 허용한다. 우측 preset/settings 영역은 밀리지 않게 유지한다.

### Table row 상세 영역

- 선택한 key가 하나 이상이면 각 최상위 compound row 바로 아래에 R-group 상세 strip을 표시한다.
- 상세 strip에는 선택한 key만 Toolbar 순서대로 가로 배치한다.
- 한 항목은 label, 구조 SVG, SMILES tooltip으로 구성한다.
- 구조를 클릭하면 기존 `StructurePreviewModal`을 재사용한다.
- 상세 항목 클릭은 `event.stopPropagation()`을 적용해 compound row 선택과 충돌하지 않게 한다.
- 해당 compound에 선택한 key가 없거나 SVG가 없으면 항목 위치는 유지하고 `-` 또는 `No match`를 표시한다. 행을 숨기지 않아 화합물 간 비교 정렬을 유지한다.
- 복수 SAR API 결과 때문에 생성되는 `record.sarApiRow` 하위 row에는 R-group을 반복하지 않는다. 최상위 compound row 아래에 한 번만 표시한다.
- 여러 key 선택 시 row가 세로로 계속 높아지지 않도록 R-group 항목을 가로로 배치한다.

예상 형태:

```text
VNA-G01-006 | TSA | Cell | MS | ...
  Core [구조]   R1 [구조]   R2 [구조]
VNA-G01-012 | TSA | Cell | MS | ...
  Core [구조]   R1 [구조]   R2 [-]
```

### 화합물 카드

- 카드 하단의 `.sar-compound-rgroup-list`, `.sar-compound-rgroup-item` 렌더링을 제거한다.
- 카드에는 화합물 구조, VNA/디자인 코드, 데이터 tag와 기존 action을 유지한다.
- R-group 제거 후 카드 높이, 1행/2행 보기, overlap, pin 고정 레이아웃을 다시 확인한다.
- 기존 R-group CSS는 Table 상세 영역에서 재사용하지 않는다면 삭제한다.

## 상태 및 파생 데이터 설계

선택 상태를 추가한다.

```ts
const [selectedRGroupKeys, setSelectedRGroupKeys] = useState<string[]>([]);
```

전체 필터 key는 `clusterRGroupsByCompoundId`의 key 합집합으로 계산한다.

```ts
const availableRGroupKeys = useMemo(() => {
  // Core 우선, R 뒤의 숫자는 숫자 기준 정렬
}, [clusterRGroupsByCompoundId]);
```

행별 상세 데이터는 기존 구조를 그대로 조회한다.

```ts
const rGroups = clusterRGroupsByCompoundId[record.id];
const value = rGroups?.[selectedKey];
```

cluster 결과 변경 시 다음 원칙을 적용한다.

```ts
selectedRGroupKeys ∩ availableRGroupKeys
```

Highlight를 Off로 바꾸거나 선택 그룹을 해제했을 때는 선택 key를 초기화한다.

## Table 구현 방향

R-group 상세 영역은 기존 `children` assay row와 의미가 다르다. 다음 조건을 만족하는 별도 row detail renderer로 구현한다.

- 최상위 compound row에만 상세 표시
- Toolbar 선택에 따라 모든 최상위 row의 상세 영역을 동시에 열고 닫음
- 기존 assay children expand 동작 유지
- 상세 영역이 전체 visible column 폭을 사용하도록 colspan 처리
- 고정 컬럼과 가로 스크롤 환경에서 상세 내용이 잘리거나 이중 스크롤되지 않게 확인

Ant Design의 `expandedRowRender`와 기존 tree `children`이 충돌하는 경우, 다음 순서로 대안을 적용한다.

1. 별도 controlled expanded detail이 기존 children과 함께 동작하는지 확인한다.
2. 충돌하면 Table datasource에 R-group 전용 synthetic detail record를 삽입한다.
3. synthetic record는 첫 visible cell만 전체 colspan을 사용하고 나머지 cell은 `colSpan: 0`으로 처리한다.
4. synthetic record는 선택, hover, pin, scroll sync 대상에서 제외한다.

구현 전 현재 사용 중인 Ant Design 버전의 Table expand/tree 동시 사용 동작을 확인한다.

## 스타일 기준

- Toolbar 버튼은 Color scale 버튼과 동일한 26px 높이와 pill 계열 radius를 우선 사용한다.
- `Core`는 최소 42px, `R1` 이후는 최소 34px 정도로 설정한다.
- 버튼 간격은 4px를 기본으로 한다.
- 상세 strip은 본문 row와 구분되는 `colorBgLayout` 또는 disabled input에 가까운 약한 음영을 사용한다.
- 상세 strip 상단/하단 border는 `colorBorderSecondary`를 사용한다.
- R-group item은 최소 72px 높이를 기준으로 하되 구조가 식별될 수 있는 크기를 확보한다.
- 상세 SVG는 aspect ratio를 유지하고 넘치는 경우 contain 처리한다.
- 다크 모드에서도 label, border, empty 상태 대비를 확인한다.

## 작업 순서

1. `clusterRGroupsByCompoundId`에서 자연 정렬된 `availableRGroupKeys`를 계산한다.
2. `selectedRGroupKeys` 상태와 toggle handler를 추가한다.
3. cluster 결과 변경 시 선택 key 정리 effect를 추가한다.
4. Color scale 우측에 Core/Rn filter toolbar를 추가한다.
5. 화합물 카드의 기존 R-group renderer를 제거한다.
6. 최상위 compound row 아래 R-group detail renderer를 추가한다.
7. 구조 클릭 시 `StructurePreviewModal` 연결과 이벤트 전파 차단을 적용한다.
8. 기존 assay children row와 expand 동작 충돌 여부를 확인한다.
9. 상세 row 추가에 맞춰 Table 세로 스크롤 및 높이 계산을 확인한다.
10. 사용하지 않는 카드 R-group CSS를 정리하고 Table 상세 CSS를 추가한다.
11. 작업 결과를 `docs/reports/2026/07/`에 보고서로 작성한다.

## 검증 시나리오

### 필터 버튼

- Comm 또는 Diff cluster 완료 후 `Core`, `R1...Rn` 버튼이 자연 정렬로 표시된다.
- 여러 버튼을 동시에 선택하고 각각 독립적으로 해제할 수 있다.
- 선택하지 않은 상태에서는 상세 row가 표시되지 않는다.
- Highlight Off 또는 그룹 해제 시 stale 버튼과 상세 구조가 남지 않는다.
- 다른 그룹으로 변경했을 때 존재하지 않는 Rn 선택값이 제거된다.

### 상세 row

- `Core` 선택 시 모든 최상위 compound row 아래에 Core 구조가 표시된다.
- `R1`, `R2`를 추가하면 동일 상세 strip에 가로로 추가된다.
- 값이 없는 compound는 위치를 유지하고 empty 상태를 표시한다.
- R-group 구조 클릭 시 정확한 compound/key의 Preview가 열린다.
- 상세 영역 클릭으로 compound 선택이 변경되지 않는다.
- 복수 assay children row에는 R-group이 중복 표시되지 않는다.

### 기존 기능 회귀

- compound card와 Table row의 선택/hover 동기화가 유지된다.
- Shift/Ctrl/Command 다중 선택이 유지된다.
- pin 고정, 카드 overlap, 1행/2행 보기가 유지된다.
- Color scale, preset, column settings가 정상 동작한다.
- Table 가로/세로 스크롤과 fixed column이 정상 동작한다.
- Comm/Diff/Off 전환과 Scaffold 사용자 지정 기능이 정상 동작한다.
- 라이트/다크 모드에서 버튼과 상세 구조가 정상 표시된다.

## 미결정 사항

- Toolbar key가 매우 많을 때 `wrap`과 가로 스크롤 중 어느 쪽을 사용할지는 실제 데이터 최대 Rn 개수를 확인한 뒤 결정한다.
- R-group 상세 item 크기는 Core/Rn 구조 식별성과 Table 밀도를 실제 화면에서 비교해 최종 조정한다.
- Ant Design tree children과 expanded detail이 충돌하는 경우 synthetic detail row 방식으로 전환한다.

## 작업 제외 범위

- `rdkit/`, `compound_search/` API 코드는 수정하지 않는다.
- R-group 계산 방식과 `cluster_v1` 응답 스키마는 변경하지 않는다.
- 실제 데이터 행을 R-group 존재 여부로 제거하는 검색 필터는 이번 범위에 포함하지 않는다.
- 빌드와 실행은 프로젝트 지침에 따라 사용자가 수행한다.
s