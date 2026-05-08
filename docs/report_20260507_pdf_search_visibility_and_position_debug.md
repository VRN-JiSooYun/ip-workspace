# PDF Search Visibility And Position Debug Report (2026-05-07)

## Goal
- Make PDF search highlights visibly stronger on the page.
- Expose the active search match position for quick debugging.

## Files
- `frontend/src/pages/PatentAnalysisDetail.tsx`

## Changes
1. Stronger search highlight styling
- Increased base search highlight opacity and contrast.
- Added stronger inset border, outer ring, and glow for the selected match.

2. Active match debug position
- Added `pdfActiveMatchDebugInfo` state.
- Captures current active match:
  - page number
  - x / y
  - width / height
  - partial matched text
- Displays this info in the toolbar area and a small debug banner.
- Logs the same data through `debugLog('pdf-search-match-position', ...)`.

## Verification
- Search term `International`
  - search highlight DOM exists
  - current match info is displayed
  - sample debug output:
    - page 1
    - x 15.44
    - y 848.91
    - width 70.28
    - height 9.14
    - text `INTERNATIONAL`
