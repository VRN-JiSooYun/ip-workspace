# MyBoard 아이디어 화합물 Cascader 선택 표시 개선

## 작업 범위
- `frontend/src/pages/MyBoard.tsx`의 아이디어 화합물 등록/수정 팝업에서 합성 목적, 합성 확장필요 정도 Cascader 표시 방식을 조정했다.

## 구현 내용
- Cascader `showCheckedStrategy`를 `Cascader.SHOW_CHILD`로 지정해 부모 항목이 아니라 선택된 하위 항목이 표시되도록 했다.
- `maxTagCount="responsive"`를 제거해 선택된 항목 tag가 부모 텍스트나 축약 텍스트로 대체되지 않고 모두 표시되도록 했다.
- 합성 확장필요 정도 저장값도 `부모 > 자식` path 대신 선택된 leaf 텍스트만 comma로 저장하도록 변경했다.
- 수정 모드에서 기존 저장값이 leaf 텍스트만 있어도 Cascader path로 복원될 수 있도록 파서를 보강했다.

## 확인 사항
- 로컬 빌드 및 실행은 프로젝트 지침에 따라 수행하지 않았다.
