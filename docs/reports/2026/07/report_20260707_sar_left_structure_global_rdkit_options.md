# SAR Left Structure Global RDKit Options

## 요청
- Header의 RDKit draw 설정이 SAR Table 좌측 영역의 화합물 구조에도 반영되게 한다.
- SAR Table 우측 화합물 카드 영역은 기존처럼 별도 SAR 카드 설정을 유지한다.

## 원인
- 좌측 그룹 대표 구조 `CompoundStructureView`는 전역 RDKit draw option 사용 기본값을 갖고 있었다.
- 하지만 호출부에서 `rdkitAtomLabelBlock`과 `rdkitAbbrevOption={0}`를 강제로 넘겨 header 공통 설정 중 atom label/abbreviation 관련 값을 덮고 있었다.
- 우측 카드 영역은 `rdkitUseGlobalDrawOptions={false}`로 명시되어 있어 전역 설정과 분리되어 있었다.

## 구현
- `frontend/src/pages/SarTable.tsx`
  - 좌측 그룹 대표 구조에서 `rdkitAtomLabelBlock`, `rdkitAbbrevOption={0}` override를 제거했다.
  - `rdkitUseGlobalDrawOptions`는 전달하지 않아 `CompoundStructureView` 기본값인 `true`를 사용한다.
  - 우측 화합물 카드 영역의 `rdkitUseGlobalDrawOptions={false}`는 유지했다.

## 확인
- `git diff --check` 통과.
- 프로젝트 지침상 build/test 실행은 하지 않았다.
