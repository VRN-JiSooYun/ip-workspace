# MyBoard Quick Viewer Mol* PDB 3D Viewer Plan

## Goal

MyBoard Quick Viewer의 `PDB` 탭에 Mol* 기반 3D 구조 viewer를 연동한다. 화면에는 Mol*의 좌측/상단/로그 패널 없이 3D canvas 중심의 viewer만 노출한다. 초기 예제 데이터는 `sample/quick_viewer/6LUB.cif`를 사용하고, 최종적으로 `pdb`, `cif/mmcif` 두 형식을 모두 지원한다.

## References

- Mol* Viewer page: https://molstar.org/viewer/
- Mol* Developer Documentation - Creating Plugin Instance: https://molstar.org/docs/plugin/instance/
- Mol* Viewer Documentation - Query Parameters: https://molstar.org/viewer-docs/query-parameters/

Key points from the official docs:

- `Viewer.create(target, options)`는 빠르게 viewer를 붙일 수 있고 `layoutShowControls`, `layoutShowLeftPanel`, `layoutShowLog` 같은 옵션으로 UI 패널을 숨길 수 있다.
- `PluginContext` + `initViewerAsync(canvas, parent)` 방식은 React UI 없이 canvas만 붙일 수 있다.
- 구조 파일은 `builders.data.download`, `builders.structure.parseTrajectory(data, format)`, `builders.structure.hierarchy.applyPreset(trajectory, 'default')` 흐름으로 로드할 수 있다.
- Mol* viewer URL parameter는 `structure-url`과 `structure-url-format`을 지원하며 format 값으로 `mmcif`, `pdb` 등을 받는다.

## Recommended Approach

### Primary: canvas-only `PluginContext`

Quick Viewer는 이미 자체 header, tabs, resize pane, CTA/info table을 가지고 있으므로 Mol* 내장 UI는 불필요하다. 따라서 `PluginContext`를 직접 생성하고 `canvas`만 Quick Viewer PDB stage에 붙이는 방식을 기본으로 한다.

Benefits:

- Mol* 좌측 패널, sequence panel, log panel, remote state UI를 렌더링하지 않는다.
- Quick Viewer의 기존 UX와 충돌하지 않는다.
- canvas 크기를 split pane/fullscreen responsive layout에 맞춰 제어하기 쉽다.
- 추후 ligand focus, representation preset, screenshot 같은 custom action을 Quick Viewer 버튼으로 별도 제공하기 쉽다.

Fallback:

- 구현 복잡도나 bundle 이슈가 크면 1차 구현은 `Viewer.create`로 시작하고 `layoutShowControls: false`, `layoutShowLeftPanel: false`, `layoutShowLog: false`, `viewportShowExpand: false`, `viewportShowSelectionMode: false`, `viewportShowAnimation: false` 옵션을 사용한다.

## Dependency Plan

Add Mol* to frontend dependencies:

```bash
bun add molstar
```

The user runs install/build inside Docker/Bun according to project rules.

Expected imports for canvas-only implementation:

```ts
import { PluginContext } from 'molstar/lib/mol-plugin/context';
import { DefaultPluginSpec } from 'molstar/lib/mol-plugin/spec';
import { PluginConfig } from 'molstar/lib/mol-plugin/config';
import 'molstar/lib/mol-plugin-ui/skin/light.scss';
```

Note: if CSS/Sass handling becomes heavy in Vite, test whether `molstar/build/viewer/molstar.css` via package/public asset is preferable. Since the UI is hidden, only canvas-related visual reset may be needed.

## File Serving Plan

Current sample file:

```text
sample/quick_viewer/6LUB.cif
```

Vite does not serve `sample/` directly. For frontend runtime loading, use one of these:

1. Copy sample assets to `frontend/public/quick_viewer/6LUB.cif`.
2. Later, replace with backend/API URLs such as `/api/structures/:id/file`.
3. For future real data, store each PDB/CIF file URL in `quickViewerAssets[].payload`.

Recommended initial public path:

```text
frontend/public/quick_viewer/6LUB.cif
```

Runtime URL:

```text
/quick_viewer/6LUB.cif
```

## Data Model Plan

Extend `CompoundQuickViewerAsset.payload` for structure viewer assets:

```ts
payload?: {
  title?: string;
  structureUrl?: string;
  structureFormat?: 'mmcif' | 'pdb';
  pdbId?: string;
  sourceLabel?: string;
}
```

Examples:

```ts
{
  type: 'pdb',
  label: 'PDB',
  resultCount: 1,
  payload: {
    title: '6LUB FGFR complex',
    structureUrl: '/quick_viewer/6LUB.cif',
    structureFormat: 'mmcif',
    pdbId: '6LUB',
    sourceLabel: 'sample CIF'
  }
}
```

For `.pdb`:

```ts
{
  structureUrl: '/quick_viewer/example.pdb',
  structureFormat: 'pdb'
}
```

## Component Plan

### New component

Create:

```text
frontend/src/components/myboard/MolstarStructureViewer.tsx
```

Props:

```ts
interface MolstarStructureViewerProps {
  structureUrl: string;
  format: 'mmcif' | 'pdb';
  title?: string;
  className?: string;
}
```

Responsibilities:

- Create `parentRef` and `canvasRef`.
- Initialize Mol* `PluginContext` once per mounted component.
- Call `plugin.initViewerAsync(canvas, parent)`.
- Load structure from `structureUrl`.
- Parse trajectory using the selected `format`.
- Apply default hierarchy preset.
- Dispose plugin on unmount.
- Reload structure when URL or format changes.
- Resize canvas when Quick Viewer split pane size changes.

Implementation notes:

- Use `ResizeObserver` on the parent element and call Mol* canvas resize/update API if available; otherwise force a browser reflow by ensuring parent/canvas dimensions are stable.
- Guard React StrictMode double effects with an `initRef` and dispose cleanup.
- Show Ant Design `Spin` while loading.
- Show `Empty` or `Alert` if load/parse fails.

### QuickViewerPanel changes

Replace `PlaceholderViewer` behavior for `asset.type === 'pdb'`:

- If `asset.payload.structureUrl` exists, render `MolstarStructureViewer`.
- If not, fallback to the current mock SVG placeholder.
- Keep existing `Select`, CTA button, and info table around the canvas.

PDB tab layout:

```text
Result select
Mol* canvas stage
VORA / detail CTA
Info table
```

CSS:

- `.quick-viewer-molstar-stage`
  - `position: relative`
  - `height: clamp(280px, 48vh, 560px)` in side pane
  - `height: calc(100vh - header/tabs/actions)` in responsive fullscreen
  - `background: #000` or token-based dark surface
  - `overflow: hidden`
- Canvas should fill the stage:
  - `position: absolute`
  - `inset: 0`
  - `width: 100%`
  - `height: 100%`

## Loading Flow

1. User clicks a `PDB` data button in MyBoard detail table.
2. Quick Viewer opens as the right split pane or fullscreen on responsive width.
3. `QuickViewerPanel` selects `activeAsset`.
4. If asset type is `pdb`, `MolstarStructureViewer` receives:
   - `structureUrl`
   - `structureFormat`
5. Mol* downloads the file from URL.
6. Mol* parses as `mmcif` or `pdb`.
7. Mol* applies default representation.
8. Viewer remains interactive inside the canvas.

## Format Handling

Use explicit format instead of guessing where possible:

- `.cif`, `.mmcif` -> `mmcif`
- `.pdb` -> `pdb`

Add helper:

```ts
const inferStructureFormat = (url: string): 'mmcif' | 'pdb' => {
  const normalized = url.toLowerCase();
  if (normalized.endsWith('.pdb')) return 'pdb';
  return 'mmcif';
};
```

But prefer `payload.structureFormat` from data, because URLs may be signed or extensionless later.

## Mock Data Plan

Initial mock:

- Copy `sample/quick_viewer/6LUB.cif` to `frontend/public/quick_viewer/6LUB.cif`.
- Update `createQuickViewerAssets` so at least one PDB asset includes:

```ts
payload: {
  title: `${compoundId || 'Design'} PDB 6LUB`,
  structureUrl: '/quick_viewer/6LUB.cif',
  structureFormat: 'mmcif',
  pdbId: '6LUB',
  sourceLabel: 'local sample'
}
```

Future mock additions:

- Add a `.pdb` sample to `frontend/public/quick_viewer/`.
- Add a second asset or selector option to verify format switching.

## UX Details

- No Mol* side panels.
- No Mol* sequence panel in the first version.
- Keep the existing Quick Viewer tabs.
- Canvas should not show decorative cards inside the stage.
- Show a small loading state over the canvas while Mol* initializes.
- On Quick Viewer close, dispose Mol* to release WebGL resources.
- On switching away from PDB tab, unmount the viewer to release resources.
- On responsive fullscreen Quick Viewer, the canvas should expand vertically and remain touch/pointer interactive.

## Risks

- Mol* bundle size is large. Mitigation: lazy-load `MolstarStructureViewer` only when PDB tab is active.
- WebGL context leaks can occur if plugin instances are not disposed. Mitigation: cleanup in `useEffect`.
- React StrictMode may double-run effects in dev. Mitigation: `initRef` guard and robust dispose.
- Vite may need CSS/Sass handling depending on Mol* import path. Mitigation: start with minimal canvas-only import; add CSS only if required.
- `sample/` files are not served by frontend dev server. Mitigation: move/copy sample structure files under `frontend/public`.

## Implementation Steps

1. Add `molstar` dependency.
2. Copy `sample/quick_viewer/6LUB.cif` to `frontend/public/quick_viewer/6LUB.cif`.
3. Extend `CompoundQuickViewerAsset.payload` type with structure fields.
4. Add sample PDB asset payload to mock data.
5. Create `MolstarStructureViewer.tsx`.
6. Replace PDB placeholder in `QuickViewerPanel` with Mol* viewer when structure URL exists.
7. Add Quick Viewer Mol* stage CSS in `MyBoard.tsx` or move Quick Viewer styles to a dedicated CSS module/file if styles grow.
8. Verify side pane layout and responsive fullscreen layout.
9. Verify loading both `mmcif` and `pdb` once a PDB sample is available.

## Verification Checklist

- PDB tab opens without Mol* side panels.
- `6LUB.cif` loads and renders in the Quick Viewer PDB stage.
- Canvas resizes when Quick Viewer split handle changes width.
- Canvas fills fullscreen Quick Viewer on responsive width.
- Switching tabs disposes the old viewer cleanly.
- Closing Quick Viewer releases WebGL resources.
- Invalid URL shows a recoverable error state.
- Existing KP, Docking, MD tabs still render as before.
