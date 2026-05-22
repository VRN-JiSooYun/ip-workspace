# Synthesis Board Detail Update Report

## 요청
- 합성 보드 페이지의 `합성 상세 목록` UI와 mock 데이터를 설계팀/합성팀 항목 기준으로 수정.

## 구현 내용
- `frontend/src/pages/SynthesisBoard.tsx`의 `SynthesisDetail` mock 타입에 설계팀/합성팀 필드를 추가.
- `mockSynthesisDetails` 각 row에 아래 데이터를 추가.
  - 설계팀: 디자인 번호, 필요량 (mg), 목적, 기대 개선 효과, 의뢰일자, 합성 확장 필요 정도, 의뢰 비고
  - 합성팀: 합성 담당자, 합성 스터디 그룹 수락일자, 합성 목표일, 진행사항 비고, 완료 여부, 등록일, 연구노트, 리포트 자료, 합성 종료 이유
- `합성 상세 목록` 테이블을 기본 식별 컬럼과 현재 사용자 팀별 상세 컬럼으로 변경.
- `설계팀 내용`, `합성팀 내용` 상위 그룹 헤더는 제거해 테이블 header가 한 줄로 보이도록 처리.
- 합성 담당자 배정 버튼은 `synthesisOwner` 기준으로 표시하도록 조정.
- 기존 `assignee` mock 필드는 제거하고 합성 담당자 데이터는 `synthesisOwner`로 통일.
- 완료 여부와 합성 확장 필요 정도는 태그 UI로 표시.
- Header 사용자 선택값(`currentUser.role`)에 따라 합성 상세 목록 컬럼을 설계팀/합성팀 컬럼으로 전환하도록 변경.
- 합성 상세 목록 제목 옆 팀 Tag는 표시하지 않음.

## 검증
- 프로젝트 지침상 빌드/실행은 수행하지 않음.
- `git diff --check` 통과.
- 변경 범위는 `SynthesisBoard.tsx`와 작업 보고서 문서로 제한.
