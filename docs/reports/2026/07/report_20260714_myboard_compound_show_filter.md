# MyBoard/SAR Table Compound 필터 확장

## 작업 내용

- 그룹 상세 목록의 `Show > Compound` 필터 판정 범위를 확장했다.
- 다음 조건 중 하나를 만족하면 Compound 목록에 표시한다.
  - `compoundId`가 존재하는 항목
  - 합성 상태가 `accepted`인 접수 완료 항목
  - 합성 상태가 `synthesizing`인 합성 중 항목
  - 합성 상태가 `vnaIssued`인 VNA코드 발급 항목
- `Show > Design`은 위 Compound 판정의 반대 집합으로 적용해 두 필터 결과가 겹치지 않도록 했다.
- `requested` 상태는 접수 완료 이전 단계이므로 `Design`에 유지한다.
- `Show > All`은 기존처럼 모든 유형을 표시한다.

## SAR Table

- 우측 화합물 카드 영역의 `Show` 필터에도 MyBoard 그룹 상세 목록과 동일한 판정을 적용했다.
- `Compound`는 `compoundId`가 있거나 합성 상태가 `accepted`, `synthesizing`, `vnaIssued`인 항목을 표시한다.
- `Design`은 위 Compound 판정의 반대 집합을 표시한다.
- `All`은 기존처럼 모든 화합물 카드를 표시한다.

## 실행 여부

- 프로젝트 지침에 따라 빌드 및 실행은 수행하지 않았다.
