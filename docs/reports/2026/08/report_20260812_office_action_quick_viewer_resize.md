# Office Action Quick Viewer 너비 조절 구현 보고서

## 작업 목적

`OfficeActionAnalysis`에서 검색 결과의 문서 Quick Viewer 너비를 마우스와 키보드로 조절할 수 있도록, 추가된 separator/pane 마크업을 실제 상태와 레이아웃에 연결한다.

## 변경 내용

- Quick Viewer 너비 상태를 추가했다.
  - 최소 너비: 380px
  - 기본 너비: 520px
  - 최대 너비: 1,000px
- separator를 마우스로 드래그하면 오른쪽 패널 너비가 포인터 위치를 따라 변경되도록 구현했다.
- 키보드 조작을 지원한다.
  - `ArrowLeft`: 24px 확장
  - `ArrowRight`: 24px 축소
  - `Home`: 최소 너비
  - `End`: 최대 너비
  - `Enter` 또는 `Space`: 기본 너비 복원
- 드래그 중에는 전역 커서를 `col-resize`로 표시하고 텍스트 선택을 막으며, 종료 시 기존 body 스타일을 복원한다.
- 비어 있던 Quick Viewer pane 안에 실제 `PatentDocumentViewer`를 배치했다.
- 기존 1,200px 이하 반응형 동작을 유지해 좁은 화면에서는 뷰어를 목록 아래에 100% 너비로 배치하고 separator를 숨긴다.
- 같은 클래스명을 사용하는 다른 특허 분석 페이지에 영향을 주지 않도록 스타일을 `.oa-page` 범위로 제한했다.

## 검증 결과

- `OfficeActionAnalysis.tsx`의 상태, 이벤트 handler, effect cleanup, JSX 연결을 정적으로 확인했다.
- 최소·최대 clamp와 `aria-valuemin`, `aria-valuemax`, `aria-valuenow` 값이 같은 상수를 사용함을 확인했다.
- 실제 뷰어가 너비 스타일을 받는 pane 내부에 포함됨을 확인했다.
- 다른 작업의 변경 파일은 수정하지 않았다.

## 미실행 항목

- 저장소 지침에 따라 빌드 및 개발 서버 실행은 수행하지 않았다.
- 브라우저에서의 드래그와 반응형 화면 확인은 사용자가 개발 환경 실행 후 수행해야 한다.
