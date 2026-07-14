# MyBoard Quick Add 기본값 비움

## 작업 범위
- `frontend/src/pages/MyBoard.tsx`의 Quick add 화합물 생성 기본값을 조정했다.

## 구현 내용
- Quick add로 추가되는 화합물의 아래 필드를 빈 문자열로 저장하도록 변경했다.
  - 출처 (`designSource`)
  - 합성 확장필요 정도 (`synthesisExpansionLevel`)
  - 합성 목적 (`assayPurpose`)
  - 합성 의뢰 번호 (`progressMemo`)
  - 디자인 비고 (`designMemo`)

## 확인 사항
- 로컬 빌드 및 실행은 프로젝트 지침에 따라 수행하지 않았다.
