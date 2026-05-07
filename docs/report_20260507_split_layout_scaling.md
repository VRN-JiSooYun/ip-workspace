# PatentAnalysisDetail Split Layout 확장 (QHD/UHD 대응)

## 변경 배경
- 기존 `PatentAnalysisDetail` 루트 컨테이너가 `maxWidth: 1600px` 고정이라, QHD/UHD에서 전체 UI가 작게 보였습니다.
- 기존 스플릿 UX(드래그 리사이즈, 30~70 제한, localStorage 저장)는 유지가 필요했습니다.

## 적용 파일
- `frontend/src/config/patentAnalysisLayout.ts`
- `frontend/src/pages/Dashboard.tsx`
- `frontend/src/pages/MyBoard.tsx`
- `frontend/src/pages/SarTable.tsx`
- `frontend/src/pages/SynthesisBoard.tsx`
- `frontend/src/pages/PatentAnalysisDetail.tsx`
- `frontend/src/pages/PatentAnalysisList.tsx`

## 적용 내용
1. 해상도별 레이아웃 프리셋 추가
   - `getSplitLayoutPreset(viewportWidth)`
   - 매핑:
     - `< 1920`: `maxWidth 1600`, `sidePadding 24`, `defaultSplit 50`
     - `>= 1920`: `maxWidth 1920`, `sidePadding 24`, `defaultSplit 52`
     - `>= 2560`: `maxWidth 2240`, `sidePadding 28`, `defaultSplit 56`
     - `>= 3200`: `maxWidth 2560`, `sidePadding 32`, `defaultSplit 58`

2. viewport 반응형 상태 추가
   - `viewportWidth` state + `resize` 이벤트 리스너
   - `layoutPreset`을 `useMemo`로 계산

3. split 기본값 로딩 정책 보완
   - `localStorage`에 저장값이 있으면 기존처럼 우선 사용
   - 저장값이 없을 때만 `layoutPreset.defaultSplit` 적용
   - clamp는 기존과 동일하게 `30~70` 유지

4. 리셋 UX를 해상도 기본값 기준으로 변경
   - 핸들 더블클릭 리셋
   - 키보드 `Enter` / `Space` 리셋
   - 모두 현재 해상도 프리셋의 `defaultSplit`으로 복귀

5. 컨테이너 폭/패딩 동적 적용
   - 루트 스타일 `maxWidth: '1600px'` -> `maxWidth: layoutPreset.maxWidth`
   - 패딩 `0 24px` -> `0 ${layoutPreset.sidePadding}px`

## 유지된 동작
- 스플릿 드래그/키보드 접근성
- split 폭 제한: 최소 `30%`, 최대 `70%`
- 사용자 split 저장/복원 키: `patent-analysis-split:{id}`

## 기대 효과
- 1920 이상 해상도에서 화면 활용도 개선
- 스플릿 UX는 동일하게 유지하면서 PDF/분석 패널 가시성 향상

## 추가 통일 적용 (List 페이지)
- `PatentAnalysisList` 루트 컨테이너에도 동일한 해상도 프리셋을 적용했습니다.
- `maxWidth`/`sidePadding` 매핑은 Detail과 동일합니다.
- 결과적으로 List/Detail 페이지 간 가로 폭, 좌우 여백 체감이 일관되게 동작합니다.

## 공통 설정 파일로 통합
- 중복되던 해상도별 프리셋 로직을 `frontend/src/config/patentAnalysisLayout.ts`로 통합했습니다.
- `PatentAnalysisDetail`과 `PatentAnalysisList`는 모두 `getPatentAnalysisLayoutPreset`을 import해 사용합니다.
- 이후 해상도 정책 변경 시 공통 파일 1곳만 수정하면 List/Detail이 동시에 반영됩니다.

## 전 페이지 적용 범위 확장
- `Dashboard`, `MyBoard`, `SarTable`, `SynthesisBoard`에도 동일 프리셋을 적용했습니다.
- 각 페이지에서 `viewportWidth` 상태와 `resize` 리스너로 프리셋을 계산하고, 루트 컨테이너의 `maxWidth`/`padding`을 동적으로 사용합니다.
- 결과적으로 주요 화면의 가로 폭 체감과 좌우 여백 정책이 동일 기준으로 동작합니다.

## MyBoard 스플릿 UX 적용
- `MyBoard`의 `그룹 리스트`/`그룹 상세 목록` 구간을 `Row/Col(10:14)` 고정 비율에서 드래그 가능한 스플릿 레이아웃으로 변경했습니다.
- 폭 제한은 `30%~70%`, 기본값은 `50%`이며 핸들 더블클릭 시 기본값으로 리셋됩니다.
- 키보드 접근성(`ArrowLeft/ArrowRight`, `Home`, `End`, `Enter/Space`)을 추가했습니다.
- 사용자 설정은 `localStorage` 키 `my-board-split:group-detail`로 저장/복원됩니다.

