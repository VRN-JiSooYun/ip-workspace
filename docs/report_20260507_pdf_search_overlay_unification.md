# PDF Search Overlay Unification Report (2026-05-07)

## Summary
- Search highlight flow was different from summary-card PDF highlighting.
- Summary cards used `dynamicHighlights` overlay rendering from known bbox data.
- Search used PDF.js text-layer DOM classes only, which caused invisible highlights and unstable debug coordinates.

## Fix
- Converted the active PDF search match into a `dynamicHighlights` area overlay.
- Reused the same highlight rendering pipeline as summary-card navigation.
- Changed coordinate scaling for search matches to use `.textLayer` / `canvas` bounds instead of the full `.page` rect.

## Result
- Search now has:
  - DOM highlight from PDF.js
  - overlay highlight through `react-pdf-highlighter-plus`
  - active-match debug output with page and scaled coordinates

## Example
- `International`
  - page `1`
  - relative rect `x 15.44, y 2.75, width 70.28, height 9.14`
  - scaled rect `[15.47, 2.76, 85.86, 11.91]`
