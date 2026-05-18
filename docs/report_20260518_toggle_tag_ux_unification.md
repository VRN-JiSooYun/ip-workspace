# Toggle Tag UX Unification

## 작업 범위
- 전체 페이지의 Ant Design `Switch` 기반 토글 UI를 특허 분석 페이지 `Recent Projects`와 같은 `Tag.CheckableTag` 기반 UX로 통일했습니다.
- 공통 컴포넌트 `ToggleTag`를 추가해 checked/onChange 동작과 `v-project-tag` 스타일 적용 방식을 재사용하도록 정리했습니다.

## 수정 파일
- `frontend/src/components/common/ToggleTag.tsx`
- `frontend/src/pages/PatentAnalysisList.tsx`
- `frontend/src/pages/MyBoard.tsx`
- `frontend/src/pages/SarTable.tsx`
- `frontend/src/pages/SynthesisBoard.tsx`
- `frontend/src/pages/ChemSpace.tsx`
- `frontend/src/pages/ChemSpace3D.tsx`

## 구현 메모
- 필터 옵션, 데이터 소스 선택, 컬럼 표시 여부, 3D 축 표시 여부 등 기존 `Switch`가 있던 UI를 `ToggleTag`로 교체했습니다.
- `Recent Projects`와 동일한 pill/tag 클릭 UX를 사용하며, 기존 선택 상태와 토글 로직은 유지했습니다.
- `rg` 기준으로 `frontend/src/pages` 및 `frontend/src/components` 안의 `Switch` 사용은 제거되었습니다.
