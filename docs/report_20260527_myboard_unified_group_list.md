# 2026-05-27 MyBoard Unified Group List

## Summary
- Removed the `My Designs` / `My Compounds` toggle area from the MyBoard group list header.
- Changed the group list to use the single `groups` array directly instead of filtering by selected data source tabs.
- Removed unused `searchType` state and setter from `useBoardStore`.
- Applied the same tab removal to the Synthesis Board group list under MyBoard and changed it to use one `currentGroups` data array.
- Removed the `Type` column from the MyBoard and Synthesis Board group tables.
- Removed date-only font-size renderers so date cells use the shared 12px table cell font size.
- Added shared multiline text styling for MyBoard long text columns so values wrap up to two lines and then show ellipsis.
- Moved the top-level group creation action from the MyBoard search toolbar to the group list title row and renamed the button to `Add group`.
- Expanded the MyBoard group list top-fix cell click target so clicking the pin cell toggles the fixed state without triggering row selection.
- Renamed MyBoard detail table headers from `Mol.Properties1` / `Mol.Properties2` to `MolProp1` / `MolProp2`.
- Reduced MyBoard detail table widths for Group, Compound ID, Stage, Source, MolProp1, and MolProp2 columns to remove extra horizontal whitespace.
- Removed structure action buttons and reduced left/right whitespace in the collapsed MyBoard group structure-only list.
- Matched the collapsed MyBoard structure-only table spacing with SAR Table by using body cell padding only and removing wrapper/frame spacing overrides.
- Added row-click multi-selection to the MyBoard detail compound table, including Add/Del/Edit header actions and a right-click context menu for split, new group, delete, edit, move, and copy workflows.

## Changed Files
- `frontend/src/pages/MyBoard.tsx`
- `frontend/src/pages/SynthesisBoard.tsx`
- `frontend/src/store/useBoardStore.ts`

## Verification
- Build and runtime verification were not executed because project instructions specify that the user runs all build and execution commands.
- Source search confirmed `selectedDataSources`, `setSelectedDataSources`, `searchType`, and `setSearchType` are no longer used in the MyBoard group-list paths.
