# 2026-05-27 Synthesis Board Detail Columns

## Summary
- Updated the Synthesis Board detail table to match the MyBoard group detail table fields used by the synthesis team.
- Excluded `Mol.Properties1` and `Mol.Properties2` from the Synthesis Board detail table.
- Removed the role-based design-team detail column branch from the Synthesis Board detail table rendering.

## Changed Files
- `frontend/src/pages/SynthesisBoard.tsx`

## Detail Table Fields
- 순번
- 그룹
- 프로젝트
- 물질 번호 (VRN)
- 화합물 구조
- 단계
- 출처
- 디자인 비고
- 합성 담당자
- 합성 스터디 그룹 수락일자
- 합성 목표일
- 진행사항 비고
- 완료 여부
- 등록일
- 연구노트
- 리포트 자료
- 합성 종료 이유

## Verification
- Build and runtime verification were not executed because project instructions specify that the user runs all build and execution commands.
- Verified by source search that design-team detail columns are no longer rendered from `SynthesisBoard.tsx`.
