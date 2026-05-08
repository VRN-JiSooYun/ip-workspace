# PDF Search DOM Highlight Fix Report (2026-05-07)

## Goal
- Stabilize search highlighting in `PatentAnalysisDetail` when using `react-pdf-highlighter-plus`.
- Make the visible highlight state follow the actual PDF.js search result DOM instead of ad-hoc text span matching.

## File
- `frontend/src/pages/PatentAnalysisDetail.tsx`

## What Changed
1. DOM sync source changed
- Replaced manual `.textLayer span` text matching with `.textLayer .highlight` lookup.
- Active result now follows `.textLayer .highlight.selected`, which is the PDF.js current match marker.

2. Async render timing handled
- Added a `MutationObserver` that re-syncs highlight classes when PDF.js updates the text layer after search or page navigation.
- Added a guard ref to avoid observer loops caused by our own class updates.

3. Visual highlight strength fixed
- Removed low-opacity text layer rendering for search feedback.
- Styled PDF.js native search classes so normal matches and the active match are clearly distinguishable.

## Why It Was Failing
- PDF text is often split across multiple spans, so `span.textContent.includes(query)` misses or mis-groups matches.
- Search highlight DOM is rendered asynchronously by PDF.js, so immediate DOM queries can race the text layer update.
- `.textLayer { opacity: 0.2; }` made search highlights look too faint even when they existed.

## Expected Result
- Search, next, and previous should now track the same match set as PDF.js.
- Visible highlight boxes should appear more consistently and with clearer contrast.
