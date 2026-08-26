# 날짜·시간 표시 포맷 개선 작업 보고서

## 작업 목적

날짜 전용 `formatDisplayDateOnly`를 날짜와 시간 모두 포맷할 수 있는 함수로 확장하고 이름을
역할에 맞게 변경한다.

## 변경 내용

- 함수명을 `formatDisplayDateTime`으로 변경했다.
- 타입명을 `DisplayDateTimeFormat`으로 변경했다.
- 기존 날짜 토큰 `YYYY`, `YY`, `MM`, `M`, `DD`, `D`를 유지했다.
- 시간 토큰 `HH`, `H`, `mm`, `m`, `ss`, `s`를 추가했다.
- 기본 포맷은 기존과 같은 `YYYY.MM.DD`라서 기존 화면 출력은 바뀌지 않는다.
- 날짜만 있는 입력에 시간 토큰을 사용하면 `00:00:00`을 기준으로 표시한다.
- 모든 Frontend 호출부와 import를 새 함수명으로 변경했다.

## 사용 예시

```ts
formatDisplayDateTime('2026-08-26T09:05:07Z');
// 2026.08.26

formatDisplayDateTime('2026-08-26T09:05:07Z', 'YYYY.MM.DD HH:mm:ss');
// 2026.08.26 09:05:07

formatDisplayDateTime('2026-08-26T09:05:07Z', 'YY-M-D H:m:s');
// 26-8-26 9:5:7
```

## 검증

- 변경 파일의 whitespace 오류를 정적으로 확인했다.
- 저장소 지침에 따라 빌드와 실행은 수행하지 않았다.
