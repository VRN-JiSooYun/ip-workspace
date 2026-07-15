# 합성 요청 팝업 에디터 Radius 복구

## 작업 목적

합성 관리 페이지로 이동된 화합물 합성 요청 팝업에서 기대 개선 효과와 비고 에디터의 둥근 테두리를 복구한다.

## 변경 내용

- 합성 요청 팝업의 `synthesis-request-memo-editor` 내부 Quill 컨테이너에 테마 `borderRadius`를 적용했다.
- 에디터 테두리 색상을 다른 팝업 입력 컨트롤과 동일한 테마 `colorBorder`로 맞췄다.
- 둥근 모서리 밖으로 에디터 내용과 배경이 노출되지 않도록 `overflow: hidden`을 적용했다.
- `synthesis-request-modal` 범위로 제한해 다른 메모 에디터에는 영향을 주지 않는다.

## 검증 결과

- 기대 개선 효과와 비고가 동일한 `synthesis-request-memo-editor` 클래스를 사용하는 것을 확인했다.
- 두 에디터의 실제 테두리를 렌더링하는 `.ql-container`에 테마 border 색상과 radius가 적용되는 것을 코드에서 확인했다.

## 미실행 항목

- 프로젝트 지침에 따라 빌드 및 실행은 수행하지 않았다.
