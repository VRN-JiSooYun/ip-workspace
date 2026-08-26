# 날짜 전용 표시 포맷 개선 작업 보고서

## 작업 목적

`formatDisplayDateOnly`가 고정된 `YYYY.MM.DD`만 반환하던 구조를 개선하여 호출부에서 원하는
날짜 포맷을 지정할 수 있게 한다.

## 변경 내용

- 두 번째 인자로 `format` 문자열을 받도록 변경했다.
- 기존 호출 호환성을 위해 기본값은 `YYYY.MM.DD`로 유지했다.
- `YYYY`, `YY`, `MM`, `M`, `DD`, `D` 토큰을 지원한다.
- 날짜로 인식할 수 없는 값과 `-`는 기존 `formatDisplayDate` 결과를 그대로 반환한다.

## 사용 예시

```ts
formatDisplayDateOnly('2026-08-26'); // 2026.08.26
formatDisplayDateOnly('2026-08-26', 'YYYY-MM-DD'); // 2026-08-26
formatDisplayDateOnly('2026-08-26', 'MM/DD/YYYY'); // 08/26/2026
formatDisplayDateOnly('2026-08-06', 'YYYY년 M월 D일'); // 2026년 8월 6일
```

## 검증

- 기존 호출부는 인자 변경 없이 기존 출력 형식을 유지한다.
- 저장소 지침에 따라 빌드와 실행은 수행하지 않았다.
