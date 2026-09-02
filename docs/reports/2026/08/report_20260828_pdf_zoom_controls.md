# PDF 배율 — 기본 100%, 폭 맞춤 버튼 분리, 직접 입력

## 작업 목적

PDF 뷰어의 배율 조작을 셋으로 정리한다.

1. 기본 배율을 **100%**로 한다.
2. **페이지 너비에 맞춤**을 별도 버튼으로 뺀다.
3. 현재 배율(%)을 **직접 입력**할 수 있게 한다.

기존에는 셋이 한 덩어리였다. 열 때는 폭 맞춤으로 시작하고, 배율 숫자는 누르면 폭 맞춤으로
되돌아가는 버튼이었으며, 임의 배율을 지정할 방법이 없었다.

## 변경 내용

### `frontend/src/hooks/usePatentPdfViewer.ts`
- `pdfScaleValue` 기본값을 `'page-width'` → `1`(100%)로 바꿨다. 폭 맞춤으로 열면 문서·패널
  폭에 따라 배율이 매번 달라져 "지금 몇 %인지"가 열 때마다 바뀐다.
- `resetPdfZoom` → `fitPdfToPageWidth`로 이름을 바꿨다. 기본 배율로 되돌리는 것이 아니라
  폭에 맞추는 별개 동작인데, 100% 기본값이 생기면서 이름이 오해를 부르게 됐다.
- `applyPdfZoom(percent)`를 공개 API에 추가했다(직접 입력 경로). 확대·축소 버튼이 쓰던 것과
  같은 함수라 클램프(25~400%)도 한 곳이다.
- `PDF_ZOOM_MIN_PERCENT`/`PDF_ZOOM_MAX_PERCENT`를 export 해 toolbar가 같은 값을 쓰게 했다
  (toolbar에 25·400이 하드코딩돼 있었다).

### `frontend/src/components/patent-analysis/pdf/PatentPdfToolbar.tsx`
- 배율 표시 버튼을 **입력 칸**으로 바꿨다. Enter 또는 포커스 아웃에서 적용하고, 범위를 벗어난
  값은 훅이 잘라 그 결과가 표시값으로 돌아온다(900 → 400%).
- **페이지 너비에 맞춤** 버튼(`MoveHorizontal`)을 확대 버튼 옆에 새로 두었다. 지금 폭 맞춤
  상태면 눌린 모양으로 남는다(`fitPageWidthActive`).
- prop 이름을 동작에 맞게 정리했다: `onResetZoom` → `onFitPageWidth`, `onZoomPercentChange`
  추가.
- 입력은 `InputNumber`가 아니라 `Input`이다. `InputNumber`는 내부에서 자기 `onKeyDown`을 달아
  바깥에서 넘긴 Enter 처리가 닿지 않는다(실측: blur로만 확정됨). 단위는 `suffix`로 보여 주고
  값에는 숫자만 남긴다.

### 호출부
- `PatentDocumentPdfPane`, `PatentAnalysisDetail`에 새 prop 세 개를 연결했다.

## 검증 결과

`frontend/office-action-harness.html`에 실제 PDF(5.2MB, 154쪽)를 임시로 물려 확인했다.

| 확인 | 결과 |
| --- | --- |
| 진입 기본 배율 | 입력 칸 `100`, `--scale-factor` 1.333(=100%) |
| 폭 맞춤 버튼 | 99%로 맞춰지고 버튼이 눌린 상태(primary)로 바뀜 |
| 직접 입력 + Enter | 175% 적용(페이지 폭 793 → 1388) |
| 직접 입력 + 포커스 아웃 | 320% 적용 |
| 범위 밖 입력(900) | 400%로 잘리고 입력 칸도 400으로 되돌아옴 |
| 확대 버튼 | 99% → 100% (기존 동작 유지) |

`tsc -b --force` 통과. 검증용으로 넣었던 임시 PDF와 harness의 임시 `documentPath`는 제거했다.

Enter 확정은 harness의 키 입력 도구로는 재현되지 않아(같은 도구로 다른 화면의 Enter도 동일하게
전달되지 않았다) React가 실제로 받는 keydown을 직접 발생시켜 확인했다. 코드 경로는
`onPressEnter → commitZoom → applyPdfZoom`으로 blur 경로와 같다.

## 미실행 항목

- 배율 단계(`PDF_ZOOM_LEVELS`)는 그대로다. 직접 입력은 단계와 무관하게 임의 값을 받는다.
- 마지막 배율을 저장하지 않는다. 문서를 새로 열면 100%로 시작한다.
- 좁은 레일에서 toolbar가 두 줄로 접히는 것은 기존 동작 그대로다(버튼이 하나 늘어 접히는
  폭이 조금 넓어졌다).
