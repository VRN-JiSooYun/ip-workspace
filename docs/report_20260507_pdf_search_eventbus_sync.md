# PDF Search EventBus Sync Report (2026-05-07)

## 변경 목적
- PDF 검색 카운터(`current/total`)를 라이브러리 EventBus 기준으로 동기화해 `3 / 12` 표기를 정확하게 유지.
- `findNext/findPrevious` 호출 이후 UI에서 수동 인덱스 계산을 제거해 오차 가능성 축소.

## 적용 파일
- `frontend/src/pages/PatentAnalysisDetail.tsx`

## 적용 내용
1. 이벤트 payload 정규화 유틸 추가
   - `extractPdfFindMatchesCount(event)` 추가.
   - 다음 형태를 모두 수용:
     - `event.matchesCount`
     - `event.detail.matchesCount`
     - `event.current / event.total`

2. EventBus 핸들러 업데이트
   - `updatefindmatchescount`, `updatefindcontrolstate` 핸들러에서 정규화 유틸로 카운터 추출 후 상태 반영.

3. 수동 인덱스 계산 제거
   - `movePdfSearchMatch`에서 `setPdfActiveMatchIndex`를 직접 증감하던 fallback 로직 제거.
   - 카운터는 EventBus 이벤트 반영 경로를 단일 소스로 사용.

## 기대 효과
- 라이브러리 내부 find controller 상태와 UI 카운터의 불일치 감소.
- 페이지 전환/검색 옵션 변경 시 카운터 정확도 개선.

