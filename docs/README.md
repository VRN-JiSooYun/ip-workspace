# docs 정리본

이 문서는 `docs/` 디렉토리의 문서를 목적별로 분류한 인덱스입니다.

## 1) 프로젝트 기준 문서 (우선 참조)

- `frontend_spec.md`
  - 프론트엔드 기술 스택/디자인 방향의 기준 문서
- `task.md`
  - 초기~중기 구현 체크리스트 및 단계별 완료 현황
- `walkthrough.md`
  - 프로토타입 결과 요약

## 2) 특허 분석 도메인 문서

- `patent_analysis_ui_ux_plan.md`
  - 특허 분석 List/Detail UI 설계 및 탭 구조 계획
- `patent_analysis_api_docs.md`
  - 샘플 API 구조/operation 정리
- `patent_analysis_swagger.yaml`
  - API 스키마 정의(Swagger)
- `patent_data_structure_analysis.md`
  - `portal.html` + 샘플 JSON 구조 분석
- `patent_data_mapping.md`
  - JSON 필드와 UI 컴포넌트 매핑 상세

## 3) 최근 구현/변경 보고서

- 작업 보고서는 날짜별로 `report_YYYYMMDD.md` 파일 하나에 누적 기록합니다.
- `report_pdf_highlight_implementation.md`
  - PDF 하이라이트 연동 구현 내용
- `report_20260521.md`
  - 2026-05-21 작업 보고서
- `report_20260520.md`
  - 2026-05-20 작업 보고서
- `report_20260519.md`
  - 2026-05-19 작업 보고서
- `report_20260518.md`
  - 2026-05-18 작업 보고서
- `report_20260512.md`
  - 2026-05-12 작업 보고서
- `report_20260508.md`
  - 2026-05-08 작업 보고서
- `report_20260507.md`
  - 2026-05-07 작업 보고서
- `report_20260422.md`
  - 다크 테마 구현 결과 보고
- `report_20260421.md`
  - MyBoard/SAR 고도화 보고

## 4) 테마/디자인 계획 문서

- `dark_theme_plan.md`
- `dark_theme_task.md`
- `dark_theme_walkthrough.md`
- `implementation_plan.md` (대시보드 리뉴얼 계획)
- `synthesis_board_plan.md`
- `wieldy_review.md`

## 5) 카드뷰 리팩토링 문서

- `card_view_refactoring_analysis.md`
  - 리팩토링 분석 문서
- `card_view_implementation_guide.md`
  - 단계별 적용 가이드
- `card_view_final_integration.md`
  - 최종 통합 결과 문서

## 6) 프로토타입 참고 자산

- `prototype/`
  - 화면 레퍼런스 PNG 모음
- `sample/Dashboard.html`
  - 초기 샘플 HTML

## 7) 정리 필요 항목

- 빈 파일
  - `card_view_completion.md`
  - `report_card_view_refactoring_20250507.md`
- macOS 메타 파일
  - `.DS_Store`

## 8) 권장 유지 기준

- 계획 문서: 최신 1개 유지, 이전 계획은 아카이브
- 보고서: 날짜별 유지하되, 월 단위 요약 문서 추가 권장
- 리팩토링 문서: `analysis`/`guide`/`final` 중 실제 기준이 되는 1개를 대표 문서로 지정
