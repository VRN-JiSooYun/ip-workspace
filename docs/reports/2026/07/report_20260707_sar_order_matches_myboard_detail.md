# SAR Table Order Matches My Board Detail

## Request
- My Board의 그룹 상세 목록 순서와 SAR Table 우측 화합물 카드 영역 및 테이블 순서를 일치시킨다.
- 단, SAR Table에서 핀 고정한 화합물은 기존처럼 먼저 표시한다.

## Implementation
- SAR Table의 compound 원본 배열 생성 방식을 My Board와 동일하게 변경했다.
  - mock compound 목록에서 external compound 중복을 제거한다.
  - external compound는 해당 그룹의 마지막 compound 뒤에 삽입한다.
- SAR Table compound 정렬 기준을 My Board 상세 목록 기준과 맞췄다.
  - 선택된 그룹 순서를 우선한다.
  - 같은 그룹 안에서는 compound 원본 배열 순서를 유지한다.
  - 그룹 선택 없이 SAR compound id 목록만 있는 경우에는 전달된 id 순서를 우선한다.
- SAR Table의 핀 고정 정렬은 유지했다.
  - 핀 고정된 compound가 먼저 나온다.
  - 핀 고정 그룹 내부와 일반 그룹 내부는 My Board 상세 목록 순서를 따른다.
- 우측 화합물 카드 영역과 SAR 테이블은 같은 `displaySarCompounds` 배열을 공유하므로 순서가 함께 일치한다.

## Verification
- 빌드/실행은 프로젝트 지침에 따라 수행하지 않았다.
- `git diff --check`로 패치 공백 오류를 확인했다.
