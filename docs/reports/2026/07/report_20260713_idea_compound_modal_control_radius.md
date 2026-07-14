# 아이디어 화합물 등록 팝업 입력 UX 통일

## 작업 내용

- 아이디어 화합물 등록/수정 팝업에서 Ant Design 입력 필드의 테마 `borderRadius`를 공통 기준값으로 사용하도록 변경했습니다.
- 일반 입력, 숫자 입력, Select/Cascader, 메모 에디터, ChemDraw 구조 에디터 외곽의 `border-radius`를 동일하게 맞췄습니다.
- Calculations 영역의 `All` 및 개별 계산 항목 토글도 같은 `border-radius`를 사용하도록 맞췄습니다.
- 변경 범위를 `.idea-compound-modal`과 `.idea-compound-form` 내부로 제한해 다른 화면의 공통 컴포넌트 스타일에는 영향을 주지 않습니다.

## 확인 사항

- 저장소 지침에 따라 빌드 및 실행은 수행하지 않았습니다.
