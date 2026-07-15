# Show 필터 접수 대기 Compound 분류

## 작업 목적

My Board와 SAR Table의 `Show` 필터에서 `접수 대기(requested)` 상태 항목을 `Design`이 아닌 `Compound` 탭에 표시한다.

## 변경 내용

- My Board 그룹 상세 목록의 타입 분류 조건을 변경했다.
- SAR Table 화합물 목록의 타입 분류 조건을 동일하게 변경했다.
- Compound ID가 있거나 합성 요청 상태가 존재하는 항목을 Compound로 분류한다.
- 이에 따라 `requested`, `accepted`, `synthesizing`, `vnaIssued` 상태가 모두 Compound 탭에 포함되고 Design 탭에서는 제외된다.

## 검증 결과

- 두 페이지에서 공통으로 `Boolean(compound.synthesisRequestStatus)`를 Compound 분류 조건에 사용하는 것을 코드에서 확인했다.
- `requested`가 타입 정의에 포함된 합성 요청 상태이므로 Compound 조건을 만족하는 것을 확인했다.

## 미실행 항목

- 프로젝트 지침에 따라 빌드 및 실행은 수행하지 않았다.
