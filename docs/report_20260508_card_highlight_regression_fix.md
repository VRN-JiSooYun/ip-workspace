# Card Highlight Regression Fix Report (2026-05-08)

## Regression Cause
- During the PDF viewer refactor, card-click highlighting stopped using stable PDF page coordinates.
- `handleGoToPdf` began converting bbox values from transient DOM sizes such as `textLayer.clientWidth` and `page.clientWidth`.
- That made highlight placement depend on render timing, split ratio, and whichever page DOM existed at click time.

## Fix
- Restored the stable card-highlight pipeline inside `usePatentPdfViewer.ts`.
- Card-click bbox conversion now uses:
  - PDF page size from `pdfDocument.getPage(page).getViewport({ scale: 1 })`
  - the configured document scale factor (`0.36`)
  - page-render readiness checks before applying the highlight
- Reintroduced a pending highlight flow so the target page waits for:
  - cached page size
  - rendered canvas
- Reintroduced delayed rebump to force the highlighter layer to re-place after late page rendering.

## Additional Adjustment
- `dynamicHighlights` now combines:
  - base `currentHighlights`
  - transient system highlights for active card focus
  - user highlights

## Expected Result
- Summary card / table card / page navigation highlight should no longer drift based on DOM layout timing.
- Search refactor stays intact, while card-click highlighting uses the older stable coordinate strategy again.
