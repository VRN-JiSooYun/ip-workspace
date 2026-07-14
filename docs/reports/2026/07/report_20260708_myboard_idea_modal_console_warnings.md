# MyBoard 아이디어 화합물 모달 콘솔 경고 수정

## 작업 범위
- `frontend/src/pages/MyBoard.tsx`의 아이디어 화합물 등록/수정 모달 콘솔 경고를 정리했다.

## 구현 내용
- 모달이 닫혀 Form이 unmount된 상태에서 `designForm.resetFields()`와 `designForm.setFieldsValue()`를 호출하지 않도록 변경했다.
- 등록/수정 초기값은 `designFormInitialValues` state로 보관하고 Form의 `initialValues`로 전달한다.
- SMILES 동기화 effect는 등록/수정 모달이 열린 상태에서만 `setFieldValue`를 호출하도록 범위를 조정했다.
- Ant Design deprecated 경고가 발생하던 `popupClassName`을 `classNames.popup.root`로 교체했다.

## 확인 사항
- 로컬 빌드 및 실행은 프로젝트 지침에 따라 수행하지 않았다.
