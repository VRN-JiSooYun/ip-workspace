# Structure PPT 링크 옆 ChemDraw 열기 버튼

## 배경
- ChemDraw 설치형/clipboard plugin이 만드는 native clipboard payload를 웹 `PPT 링크 복사` 버튼에서 직접 재현하기는 어렵다.
- 대신 구조를 ChemDraw JS로 열고, 사용자가 ChemDraw 안에서 구조를 선택해 복사하면 기존 plugin/native clipboard 흐름을 사용할 수 있다.

## 변경 내용
- `frontend/src/components/common/CompoundStructureView.tsx`
  - `showChemDrawAction` prop을 추가했다. 기본값은 `true`.
  - `PPT 링크 복사` action이 표시되고 구조 데이터(`cdxml`, `molBlock`, `smiles`)가 있으면 공통 ChemDraw 열기 버튼을 자동 추가한다.
  - 호출부에서 이미 `key: 'chemdraw'` action을 넘긴 경우에는 중복 버튼을 만들지 않는다.
  - action 순서를 `크게 보기` → `이미지 복사` → `PPT 링크 복사` → `ChemDraw 열기` → `구조 데이터 복사` → 기타 action으로 정리했다.
  - 내장 ChemDraw 버튼은 공통 `ChemDrawModal`을 열고 현재 구조를 초기값으로 전달한다.

## 확인 필요
- 로컬 실행은 사용자가 진행한다.
- 구조 overlay에서 `PPT 링크 복사` 바로 오른쪽에 `ChemDraw 열기` 버튼이 배치되는지 확인 필요.
- ChemDraw에서 구조 선택 후 복사 시 설치형 ChemDraw/PowerPoint plugin 연동이 기대대로 동작하는지 실환경 확인 필요.
