# Card Highlight Rebump Tuning Report (2026-05-08)

## Goal
- Reduce visible flicker caused by unconditional card-highlight rebump.
- Remove inner fill from active compound highlights and keep only the outline.

## Changes
1. Conditional rebump
- Stored the initial active compound highlight viewport size.
- Re-run rebump only when the target page canvas size actually changes after the first highlight render.
- Removed the previous unconditional clear-and-redraw pattern on every card click.

2. Compound highlight style
- `active_compound_highlight` background was changed from semi-transparent red to `transparent`.
- The card highlight now visually emphasizes the border only.

## Expected Result
- Card click should no longer flash on every interaction.
- Rebump still happens when late PDF rendering really changes the geometry.
- Active card highlight appears as a clean outline without inner background fill.
