# 의견제출통지서 관련도 자동 정렬 작업 보고서

## 작업 목적

키워드 검색 결과의 Sort By를 관련도순으로 자동 적용하고 외부 API의 관련도 점수를 보존한다.

## 변경 내용

- 외부 응답의 `relevance_score`를 backend `relevanceScore`로 변환했다.
- frontend `PatentSearchItem`에도 nullable `relevanceScore`를 추가했다.
- 마지막으로 실행한 검색에 키워드가 있으면 Sort By를 `관련도순`으로 자동 전환한다.
- 키워드를 비우고 검색하면 `의견제출통지서 발행일자순`으로 복원한다.
- Sort By는 외부 API의 자동 정렬 결과를 설명하는 읽기 전용 표시로 구성했다.
- 개발 harness fixture와 검색 API 문서를 새 응답 계약에 맞췄다.

## 외부 API 확인 결과

2026-08-25 OpenAPI에는 별도 정렬 요청 필드가 없다. 실제 키워드 검색을 확인한 결과
`relevance_score`가 응답되고 점수가 높은 순서로 정렬되어 있었다. 따라서 프런트 페이지 단위
재정렬은 추가하지 않았다.

## 검증 결과

- `relevance_score` 보존을 확인하는 backend 단위 테스트를 추가했다.
- 타입 사용처와 Sort By 전달 경로를 정적으로 확인했다.

## 미실행 항목

- 저장소 지침에 따라 빌드·테스트·Docker 실행은 수행하지 않았다.
