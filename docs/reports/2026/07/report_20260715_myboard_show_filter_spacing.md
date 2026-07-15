# MyBoard Show 필터 여백 통일

## 변경 내용

- MyBoard 그룹 상세 목록 toolbar의 Show 필터 Segmented에 `margin-left: 2px`를 적용했다.
- `Show` 라벨과 `All` 옵션 사이 간격을 SAR Table과 같은 총 8px로 맞췄다.

## 검증 결과

- SAR Table의 Show 필터 여백 규칙과 MyBoard 적용값을 비교했다.
- `git diff --check`로 변경 파일의 공백 오류를 확인했다.

## 미실행 항목

- 프로젝트 지침에 따라 빌드와 실행은 수행하지 않았다.
