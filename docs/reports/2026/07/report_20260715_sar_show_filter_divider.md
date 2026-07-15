# SAR Table Show 영역 Divider 변경

## 작업 목적

SAR Table 화합물 설정 도구 모음에서 `Show` 영역 왼쪽 구분선을 Ant Design `Divider`로 통일한다.

## 변경 내용

- `Show` 영역 앞에 Ant Design 세로 `Divider`를 추가했다.
- 기존 `.sar-compound-show-filter::before` 가상 구분선을 제거했다.
- 기존 가상 구분선을 위해 적용했던 `position`과 왼쪽 여백을 정리했다.
- Divider 높이를 18px로 유지하고 테마의 보조 테두리 색상을 적용했다.

## 검증 결과

- `Show` 영역 앞에 `Divider type="vertical"`이 렌더링되는 구조를 확인했다.
- 동일 위치에 가상 구분선이 남아 중복 표시되지 않는 것을 코드에서 확인했다.

## 미실행 항목

- 프로젝트 지침에 따라 빌드 및 실행은 수행하지 않았다.
