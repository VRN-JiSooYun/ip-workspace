# SAR Table Comm 공통 Scaffold ChemDraw 자동 입력

## 목적

- SAR Table에서 Highlight가 `Comm`일 때 `Scaffold` 버튼을 누르면 현재 cluster의 공통 골격이 ChemDraw에 자동으로 그려지게 한다.
- 공통 골격은 `cluster_v1` 응답의 개별 `murcko_scaffold`가 아닌 cluster가 선택한 `substructure` SMILES를 사용한다.

## 변경 내용

- `cluster_v1` 렌더링 결과에서 처음 확인되는 유효한 `substructure`를 공통 scaffold SMILES로 보관한다.
- cluster 요청 시작, 비활성화, 실패 시 이전 공통 scaffold 값을 제거해 다른 목록의 구조가 재사용되지 않게 했다.
- Highlight가 `Comm`이고 사용자 지정 scaffold가 없으면 공통 `substructure`를 `ChemDrawModal`의 `initialSmiles`로 전달한다.
- 기존 사용자 지정 scaffold가 있으면 저장된 CDXML 또는 SMILES를 계속 우선 사용한다.
- MolBlock에는 선행 공백을 제거하는 `trim()`을 사용하지 않고 줄바꿈 정규화와 `trimEnd()`만 적용한다. 빈 document title을 가진 MolBlock의 3줄 header가 유지된다.
- 공통 scaffold가 준비된 경우 버튼 Tooltip에 ChemDraw에서 공통 scaffold를 편집한다는 안내를 표시한다.

## 동작

1. SAR Table이 현재 표시 화합물을 `cluster_v1`에 전달한다.
2. API가 선택한 공통 scaffold가 각 결과의 `substructure`에 반환된다.
3. 사용자가 `Comm` 상태에서 `Scaffold`를 누르면 해당 SMILES가 ChemDraw 초기 구조로 로드된다.
4. 사용자가 구조를 수정하고 `적용`하면 기존 사용자 지정 scaffold 저장 흐름을 그대로 사용한다.

## 검증

- `substructure` 상태의 설정 및 초기화 경로를 정적으로 확인했다.
- 사용자 지정 scaffold 우선순위와 Comm 자동 입력 fallback을 확인했다.
- Scaffold MolBlock의 저장, baseline, API 요청 경로에서 선행 header line이 보존되는지 확인했다.
- `git diff --check`를 수행했다.
- 프로젝트 지침에 따라 프론트엔드 빌드와 실행은 수행하지 않았다.
