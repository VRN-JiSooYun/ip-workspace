# SAR Table Core/R-group Row 표시 필터 적용

## 작업 목적

- 화합물 카드에 표시되던 Core/R-group 구조를 SAR Table의 행별 비교 영역으로 이동한다.
- cluster 응답에 존재하는 R-group key를 사용자가 복수 선택해 비교할 수 있게 한다.

## 변경 내용

- `clusterRGroupsByCompoundId`의 key 합집합으로 `Core`, `R1`, `R2` 순서의 표시 필터를 생성했다.
- Color scale 우측에 복수 선택 가능한 pill 버튼을 추가하고, cluster 요청 중에는 기존 버튼과 상세 영역을 비활성화했다.
- Highlight가 Comm, Diff, Off 중 다른 옵션으로 변경되거나 그룹 선택이 해제되면 선택 key를 모두 초기화하고, cluster 결과가 변경되면 존재하지 않는 key를 선택 상태에서 제거하도록 했다.
- 선택한 key가 있을 때 각 최상위 compound row 다음에 synthetic 상세 row를 추가했다.
- 상세 row는 모든 visible column을 `colSpan`으로 사용하고, 선택한 Core/R-group을 가로 strip에 같은 순서로 배치한다.
- 값이나 SVG가 없는 항목은 위치를 유지하면서 `-`로 표시한다.
- 구조 항목 클릭 시 기존 `StructurePreviewModal`을 열고 이벤트 전파를 차단해 compound 선택과 충돌하지 않게 했다.
- synthetic 상세 row는 compound 선택, hover, pin 및 assay response row 상태에서 제외했다.
- 기존 assay `children` 데이터와 expand 설정은 유지하고, 하위 assay row에는 R-group 상세를 반복하지 않는다.
- 화합물 카드의 기존 R-group 렌더러와 전용 CSS를 제거했다.
- 필터 key가 많을 때 좌측 toolbar 영역만 가로 스크롤되도록 하여 우측 preset/settings 영역을 유지했다.
- Color scale 버튼의 42px 폭, 26px 높이, pill 외곽선, 11px/700 텍스트와 활성 outline을 Core 버튼 규격에 맞췄다.
- Core/Rn 버튼의 border 스타일은 변경하지 않고, Color scale 비활성 border에 Core 버튼과 같은 Ant Design `colorBorder` token을 적용했다.
- Core/R-group SVG에 기존 SAR 구조 이미지와 같은 다크모드 색상 반전·색조 보정을 적용해 결합선과 atom label의 대비를 확보했다.
- R-group 표시 필터 우측에 단일 기준을 선택하는 `Group by` 드롭다운과 활성 기준 해제 버튼을 추가했다.
- Group by 기준을 선택하면 해당 Core/Rn 표시 필터도 자동으로 활성화하고, 기준 표시를 끄면 그룹화도 함께 해제되도록 했다.
- RDKit cluster 응답의 R-group SMILES를 기준으로 동일 값을 연속 배치하고, SMILES가 없으면 SVG를 보조 식별자로 사용했다.
- pinned compound와 일반 compound의 상단 고정 순서를 유지하면서 각 구간 내부를 독립적으로 그룹화했다.
- 동일 그룹 내부에서는 기존 compound 순서를 유지하고 `No match` 그룹은 각 구간의 마지막에 배치했다.
- 그룹 시작 compound row에 구분선을 표시하고 상세 strip 상단에는 기준 Rn과 compound 개수 배지를 표시했다.
- Highlight 옵션 또는 선택 그룹이 변경되거나 cluster 결과에 기준 key가 없어지면 Group by 상태를 초기화했다.
- 라이트/다크 테마 token을 사용하는 상세 strip, 빈 상태, 활성 버튼 스타일을 추가했다.

## 검증 결과

- 이전 화합물 카드 R-group 클래스와 렌더링 참조가 제거된 것을 검색으로 확인했다.
- 새 표시 필터, synthetic row, `colSpan`, Preview 연결 및 선택 예외 처리를 코드 기준으로 확인했다.
- Highlight 옵션 변경을 감지하는 effect가 기존 R-group 표시 필터를 모두 해제하는지 코드 기준으로 확인했다.
- Core/R-group SVG의 필터가 다크모드에서만 적용되고 라이트모드에서는 원본 색상을 유지하는지 코드 기준으로 확인했다.
- Group by 선택·해제, 표시 필터 자동 활성화, pinned 구간 분리, 동일 값 안정 정렬 및 No match 후순위 처리를 코드 기준으로 확인했다.
- `git diff --check`로 변경 파일의 공백 오류를 확인했다.

## 미실행 항목

- 프로젝트 지침에 따라 빌드와 실행은 수행하지 않았다.
- 브라우저에서 Comm/Diff 전환, 복수 key 선택, assay children 확장, 가로/세로 스크롤 및 라이트/다크 모드를 확인해야 한다.
