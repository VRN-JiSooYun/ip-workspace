# 2026-05-27 Global Font Size Reduction

## Summary
- Reduced explicit `fontSize` and CSS `font-size` values across frontend pages and shared UI components by 1px.
- Added Ant Design theme font-size tokens in `App.tsx` so default component text also renders 1px smaller.
- Preserved the existing Synthesis Board detail table field changes.
- Refactored table header/cell font sizes into shared CSS variables and removed date-only inline font-size renderers.
- Set default Ant Design `Typography.Text` (`span.ant-typography`) rendering to 12px in global CSS.
- Set the left sidebar `VORA` and `Medichem ELN` quick-link buttons to 12px text and 34px height.

## Changed Files
- `frontend/src/App.tsx`
- `frontend/src/index.css`
- `frontend/src/pages/*`
- `frontend/src/components/*`

## Verification
- Build and runtime verification were not executed because project instructions specify that the user runs all build and execution commands.
- Source search confirmed no accidental `fontSize: -1` or `font-size: -1px` values remain.
