# PDF Search Follow-up Fix Report (2026-05-07)

## Goal
- Remove the React warning caused by state updates during `PdfLoader` render.
- Make the PDF search toolbar explicitly show when there are no matches.

## Files
- `frontend/src/pages/PatentAnalysisDetail.tsx`

## Changes
1. Extracted PDF render body into `PatentPdfRenderer`
- Moved `pdfDocument`, `numPages`, and page-size side effects into `useEffect`.
- Prevented `setPdfTotalPages(...)` from running inside the `PdfLoader` render callback.

2. Added no-result search feedback
- Added `pdfSearchExecuted` state.
- Search counter now shows `0 matches` after a completed search with no result instead of `-/-`.

## Verification
- `EGFR` search: `0 matches`, no `.textLayer .highlight`
- `International` search: counter updates and `.textLayer .highlight` / `.selected` are present
