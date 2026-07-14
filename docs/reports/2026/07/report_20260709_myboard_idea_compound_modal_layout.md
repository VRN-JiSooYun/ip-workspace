# MyBoard 아이디어 화합물 팝업 UX 수정

## 변경 내용
- `frontend/src/pages/MyBoard.tsx`
  - 아이디어 화합물 등록/수정 팝업 첫 row를 4비율 그리드로 변경했다.
    - `타겟` 1, `그룹` 2, `아이디어 번호` 1 비율.
  - label column 폭을 `132px` 기준으로 통일하고 `화합물 구조`/SMILES 시작 위치를 맞췄다.
  - SMILES input control에 좌측 offset을 추가해 ChemDraw 좌측 버튼 rail이 아닌 canvas 시작 위치와 맞췄다.
  - SMILES 필수 검증은 유지하되 label 영역의 필수 표시만 제거했다.
  - disabled input text color를 검은색으로 보정했다.
  - ChemDraw helper 문구를 숨기고, ChemDraw 우측 outline이 잘리지 않도록 control 영역에 우측 여백을 추가했다.
  - SMILES textarea resize를 비활성화했다.
  - 그룹 표시값을 `[순번] 타이틀` 형식으로 변경했다. 저장 데이터는 기존 group id/title 흐름을 유지한다.
  - 합성 의뢰 번호를 disabled 처리했다.
  - 합성 의뢰 번호부터 별도 section으로 묶고 위/아래 여백과 구분선을 추가했다.
  - 합성 필드 배치를 다음 순서로 변경했다.
    - `합성 의뢰 번호` | `합성 목적` | `합성 확장필요 정도` | `필요량`
    - `기대 개선 효과` | `합성 의뢰 비고`
  - 팝업 안 `합성 목적`, `합성 확장필요 정도` 다중 선택 dropdown의 checkbox 표시를 숨기고 항목을 toggle button 형태로 보이게 변경했다.
  - `합성 목적`의 `레퍼런스`는 별도 `레퍼런스 이름 입력` option 대신 `레퍼런스` 선택 시 Cascader popup 자식 패널에 노출되는 Input에 이름을 입력하는 방식으로 변경했다.
  - `레퍼런스` popup Input 값을 Form field로 직접 바인딩하고, 선택 tag도 `레퍼런스: 입력값`으로 갱신되도록 처리했다.
  - `레퍼런스` popup Input에서 Backspace 등 키 입력이 Cascader로 전파되어 popup이 닫히지 않도록 보정했다.
  - `기대 개선 효과`, `합성 의뢰 비고`를 `PlainMemoEditor` 기반 editor로 변경하고 저장 시 memo 값 정규화를 적용했다.
  - 두 editor height를 `디자인 비고` editor와 동일하게 맞췄다.
  - 상세 목록에서 `기대 개선 효과`, `의뢰 비고`는 디자인 비고와 같은 preview renderer를 사용하도록 변경했다.
  - 팝업 안 `Calculations` 선택 버튼을 row당 5개씩 배치하도록 grid column을 조정했다.
- `frontend/src/components/common/ChemDrawEditor.tsx`
  - `showHelperText` prop을 추가해 호출부에서 helper 문구 표시 여부를 제어할 수 있게 했다.

## 확인 필요
- 로컬 실행은 사용자가 진행한다.
- 등록/수정 팝업에서 4컬럼 배치, label 정렬, disabled 색상, SMILES resize 비활성화, ChemDraw outline 표시, `Calculations` 버튼 5열 배치를 확인한다.
- 등록/수정 후 그룹 상세 목록에서 `기대 개선 효과`, `의뢰 비고`가 HTML 태그 없이 preview로 보이는지 확인한다.
