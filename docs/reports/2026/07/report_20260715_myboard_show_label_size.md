# My Board Show 라벨 크기 통일

## 작업 목적

My Board의 그룹 상세 목록에 표시되는 `Show` 텍스트 라벨을 SAR Table 페이지의 `Show` 라벨과 같은 크기 규격으로 맞춘다.

## 변경 내용

- My Board 그룹 상세 목록의 `Show` 라벨에 SAR Table 설정 라벨과 동일한 `min-width: 42px`를 적용했다.
- 라벨의 `font-size: 10px`, `font-weight: 600`, `line-height: 18px`, 왼쪽 정렬 및 줄바꿈 방지 규격을 SAR Table과 맞췄다.
- `Del` 버튼과 `Show` 영역 사이에 Ant Design 세로 `Divider`를 추가했다.
- 기존 `Show` 영역의 CSS 가상 구분선은 제거해 실제 `Divider`와 중복되지 않도록 했다.

## 검증 결과

- My Board와 SAR Table의 `Show` 라벨 스타일 선언을 코드에서 비교했다.
- 두 라벨의 글자 크기, 굵기, 줄 높이 및 42px 최소 너비가 동일한 것을 확인했다.
- 버튼 영역과 `Show` 영역 사이에 실제 Ant Design `Divider`가 배치되는 것을 코드에서 확인했다.

## 미실행 항목

- 프로젝트 지침에 따라 빌드 및 실행은 수행하지 않았다.
