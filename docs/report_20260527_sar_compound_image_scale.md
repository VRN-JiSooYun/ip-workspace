# 2026-05-27 SAR Compound Image Scale

## Summary
- Added an image size control to the SAR Table compound card toolbar.
- The control is shown only in the default single-row compound card view.
- Users can adjust the compound structure image/card size with a slider or numeric percentage input.
- Default size is 100%, with a range from 30% to 150%.
- Clicking an already selected compound card or SAR table row now clears the selection.
- Removed action buttons from the SAR compound structure view so the structure area shows only the SVG image.
- Set the group structure table body's `compound-structure-view` to keep only 2px left and right margins inside the SAR group structure card.

## Changed Files
- `frontend/src/pages/SarTable.tsx`

## Verification
- Build and runtime verification were not executed because project instructions specify that the user runs all build and execution commands.
- Static diff validation was run with `git diff --check`.
