# Dark Mode SVG Visibility

## 변경 내용
- 다크모드에서 SVG 구조 이미지의 검은 선이 배경에 묻히지 않도록 공통 CSS 보정 대상을 확장했다.
- 기존 특허 분석 SVG 렌더러 외에 My Board, SAR Table, Synthesis Board의 구조식 SVG와 미리보기 모달 SVG에도 동일한 보정을 적용했다.
- SVG 내부 inline `stroke`/`fill` 색상까지 대응하기 위해 CSS 색상 override가 아니라 `filter: invert(0.88) hue-rotate(180deg)` 방식을 사용했다.

## 관련 파일
- `frontend/src/index.css`

## 적용 대상
- `raw-data-svg-frame`
- `svg-renderer-frame`
- `my-board-structure-svg`
- `my-board-structure-preview`
- `sar-structure-svg`
- `sar-structure-preview`
- `synthesis-structure-svg`
- `synthesis-structure-preview`
