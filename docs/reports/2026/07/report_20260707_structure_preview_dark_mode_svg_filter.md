# Structure Preview Dark Mode SVG Filter

## Request
- 다크 모드에서 compound 크게보기 팝업의 화합물 구조 이미지 선색상이 라이트 모드 기준으로 보여 잘 안 보이는 문제 수정.

## Implementation
- `StructurePreviewModal`의 2D SVG 표시 영역에 기존 이미지 복사용 테마 필터를 동일하게 적용했다.
- 다크 모드에서는 `getStructureImageCopyFilter`가 반환하는 `invert/hue-rotate` 필터를 사용해 검정 계열 구조선을 밝게 보이도록 했다.
- 라이트 모드에서는 필터가 적용되지 않아 기존 표시를 유지한다.
- My Board, SAR Table, Synthesis Board, Patent Analysis, Universal Search 등 모든 `StructurePreviewModal` 사용처가 같은 공통 SVG host 필터를 타도록 정리했다.
- 페이지별 className 유지와 별개로 크게 보기 컨테이너에 공통 `structure-preview-modal` class를 항상 부여했다.
- 전역 CSS의 페이지별 크게 보기 preview selector는 중복 필터가 걸리지 않도록 제거하고, 테이블/카드 내부 구조 SVG selector만 유지했다.

## Verification
- 빌드/실행은 프로젝트 지침에 따라 수행하지 않았다.
- `git diff --check`로 패치 공백 오류를 확인했다.
