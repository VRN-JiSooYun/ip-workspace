# SAR Table VNA Code 디자인 번호 Fallback 및 색상 동기화

## 작업 범위
- `frontend/src/pages/SarTable.tsx`의 SAR Table `VNA Code` 컬럼과 화합물 카드 VNA Code 표시값을 조정했다.

## 구현 내용
- 기존 우선순위인 SAR API `compound_code` 값을 먼저 사용한다.
- API 값과 `compoundId`가 모두 비어 있으면 MyBoard의 `designNo` 값을 표시한다.
- `designNo`도 없을 때만 `-`를 표시한다.
- `designNo` fallback으로 표시되는 값은 옅은 회색(`token.colorTextTertiary`)으로 표시한다.
- `getSarDisplayCode` helper를 추가해 테이블 컬럼과 화합물 카드가 같은 표시값/색상 규칙을 사용하도록 했다.

## 확인 사항
- 로컬 빌드 및 실행은 프로젝트 지침에 따라 수행하지 않았다.
