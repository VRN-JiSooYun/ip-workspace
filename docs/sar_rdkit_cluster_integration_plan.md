# SAR RDKit Cluster Integration Plan

## Current State

- SAR Table compound cards are rendered in `frontend/src/pages/SarTable.tsx`.
- The `Com / Diff / Off` segmented control currently only updates `groupStructureViewSettings[groupId].sarHighlightMode`.
- Compound structure images are rendered by `CompoundStructureView`, which currently calls RDKit `/draw` through `frontend/src/services/structureRendering.ts`.
- RDKit API base URL already exists as `VITE_RDKIT_API_URL`, defaulting to `/rdkit-api`.
- The local RDKit FastAPI service already exposes `POST /cluster` in `rdkit/main.py`.

## RDKit `/cluster` Contract

Request shape:

```json
{
  "data": [
    {
      "id": "compound-1",
      "SMILES": "CCO",
      "molblock": "..."
    }
  ],
  "scaffold_align": true,
  "reverse_highlighting": false,
  "highlight_alpha": 0.6,
  "group_by": "cluster_id",
  "angle": 0,
  "fixed_bond_length": 42,
  "min_size": [200, 200],
  "transparent_bg": true,
  "abbrev_option": 1
}
```

Response shape:

```json
{
  "groups": {
    "0": [
      {
        "id": "compound-1",
        "SMILES": "CCO",
        "molblock": "...",
        "murcko_scaffold": "...",
        "highlight_atoms": [0, 1, 2],
        "substructure": "...",
        "highlight_color": "red",
        "cluster_id": 0,
        "svg": "<svg>...</svg>"
      }
    ]
  },
  "error": null
}
```

## Mode Mapping

- `Com`: call `/cluster` with `reverse_highlighting: false`.
  - RDKit highlights common scaffold/substructure atoms.
- `Diff`: call `/cluster` with `reverse_highlighting: true`.
  - RDKit highlights atoms outside the common scaffold/substructure.
- `Off`: do not use cluster SVGs.
  - Keep existing `/draw` output from `CompoundStructureView`.

## Frontend Implementation Plan

1. Add RDKit cluster service APIs in `frontend/src/services/structureRendering.ts` or a new `rdkitCluster.ts`.
   - Reuse `VITE_RDKIT_API_URL`.
   - Add request/result TypeScript types.
   - Add a cache keyed by:
     - compound id list
     - each compound structure source signature
     - highlight mode
     - angle
     - scale/fixed bond length
     - min size
   - De-duplicate in-flight requests like the existing `/draw` cache.

2. Normalize SAR compound input before API call.
   - Send `molblock` when available.
   - Otherwise send `SMILES`.
   - Include `id`, `compoundId`, and `name` so response rows can map back to UI cards.
   - Skip invalid compounds without structure source, and show a non-blocking warning state if all are invalid.

3. Load cluster SVGs when Com/Diff is active.
   - Trigger from `SarTable.tsx` when:
     - selected group changes
     - `sarHighlightMode` changes to `com` or `diff`
     - scale/rotation/min size changes
     - displayed SAR compound list changes
   - Use `AbortController` or request sequence id to avoid stale response applying after rapid mode changes.

4. Store cluster SVGs locally in `SarTable`.
   - Recommended local state:
     - `clusterSvgByCompoundId: Record<string, string>`
     - `clusterMetaByCompoundId: Record<string, { clusterId?: string; highlightAtoms?: number[]; substructure?: string; highlightColor?: string }>`
     - `isClusterLoading`
     - `clusterError`
   - Keep this local to SAR Table first. Do not put large SVG strings into Zustand unless cross-page reuse is required.

5. Render cluster SVGs in compound cards.
   - When active mode is `com` or `diff` and `clusterSvgByCompoundId[item.id]` exists, pass that SVG into `CompoundStructureView`.
   - Best option: add an override prop to `CompoundStructureView`, for example `renderedSvgOverride`.
   - Avoid mutating `mockCompounds.rdkitSvgCache` for cluster output because cluster output depends on the current compound set, highlight mode, and alignment.

6. Preserve current layout controls.
   - `Scale` should map to `fixed_bond_length` similarly to `/draw`.
   - `Rotate` should map to `/cluster` `angle`.
   - `min_size` should use the current compound card frame size.
   - `Overlap`, pinning, selection, and scrolling remain UI-only.

7. Loading and error UX.
   - Disable only `Com/Diff` toggles or show a small spinner near the segmented control while `/cluster` is loading.
   - Keep previous successful cluster SVGs visible until the new response arrives, unless mode becomes `Off`.
   - If `/cluster` fails, show existing unhighlighted structures and a compact error message or tooltip near the toggle.

8. Response ordering and grouping.
   - RDKit returns grouped objects and may sort them internally.
   - Do not use response order for display order.
   - Flatten `groups`, map by `id`, and keep existing `displaySarCompounds` order.

## Backend/API Notes

- `/cluster` currently returns HTTP 200 with `error` populated on processing failure. Frontend must check both `response.ok` and `result.error`.
- `substructure_color_dict` is optional. Initial integration should omit it and use RDKit Murcko scaffold clustering.
- If product wants a single user-selected reference scaffold later, add a second phase where the selected/pinned compound provides `substructure_color_dict`.

## Verification Plan

- Select one SAR group, toggle `Com`, confirm cards show aligned scaffold highlights.
- Toggle `Diff`, confirm highlight region changes and cards remain aligned.
- Toggle `Off`, confirm existing normal RDKit drawings are shown.
- Change scale/rotation and confirm `/cluster` refreshes with matching size/orientation.
- Rapidly switch group/mode and confirm stale API responses do not overwrite current view.
- Test missing `molBlock` rows using SMILES fallback.
