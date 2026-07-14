# MyBoard 그룹 상세 목록 중앙 정렬

## 변경 내용
- `frontend/src/pages/MyBoard.tsx`
  - 그룹 상세 목록 테이블의 모든 동적 컬럼이 `align: center`를 적용받도록 변경했다.
  - 기존에는 multiline 긴 텍스트 컬럼이 중앙 정렬 대상에서 제외되어 있었다.
  - 디자인 비고 preview의 텍스트/이미지 stack을 중앙 정렬로 변경했다.
- `frontend/src/index.css`
  - `.my-board-multiline-text`에 `margin: 0 auto`와 `text-align: center`를 적용해 긴 텍스트 셀 내부 내용도 중앙에 오도록 보강했다.

## 확인 필요
- 로컬 실행은 사용자가 진행한다.
- 그룹 상세 목록에서 긴 텍스트 컬럼(`목적`, `기대 개선 효과`, `의뢰 비고`, `진행사항 비고`, `리포트 자료`, `합성 종료 이유`, `디자인 비고`)이 중앙 정렬되는지 확인 필요.
