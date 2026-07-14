# Patent Insight UI/UX Implementation Plan

## Context

- Target menu: `Documents > Patents > Insight`
- Prototype files:
  - `sample/patnent_insight/img1.png`
  - `sample/patnent_insight/img2.png`
  - `sample/patnent_insight/spatent_insight_api.md`
- Note: the current sample folder name is `patnent_insight`, not `patent_insight`.

The provided sketches describe a patent statistics dashboard similar to Power BI. The main information groups are:

- `total_count`
- `filtered_count`
- `count_across_time`
- `patent_per_office`
- `filling_language_counts`
- `patent_type_counts`
- `patent_count_by_applicant`
- `patent_count_by_target_and_applicant`

This page should be implemented as a work-focused analytics dashboard, not as a marketing-style page.

## API Scope

Source document: `sample/patnent_insight/spatent_insight_api.md`

External upstream endpoints:

- `POST http://172.16.1.210:8000/patent_statistics_refresh/`
  - Refreshes statistics.
  - The note says this needs to run once per day.
- `POST http://172.16.1.210:8000/get_all_statistics/`
  - Request fields:
    - `applicant`
    - `from_date`
    - `to_date`
    - `top_n_applicant`
    - `top_n_target`
  - Response fields:
    - `total_count`
    - `filtered_count`
    - `count_across_time`
    - `patent_per_office`
    - `filling_language_counts`
    - `patent_type_counts`
    - `patent_count_by_applicant`
    - `patent_count_by_target_and_applicant`

Frontend-facing backend endpoints:

- `POST /api/patents/insight/statistics`
  - Backend reverse proxies to `GET {PATENT_INSIGHT_API_URL}/get_all_statistics/` with query params.
- `POST /api/patents/insight/refresh`
  - Backend reverse proxies to `POST {PATENT_INSIGHT_API_URL}/patent_statistics_refresh/`.

Implementation approach:

- Frontend must not call `http://172.16.1.210:8000` directly.
- Browser requests should go through the existing frontend proxy path:
  - local Vite: `/api -> local-myworkspace-backend:3000`
  - dev nginx: `/api -> dev-myworkspace-backend:3000`
- Add or update frontend service file: `frontend/src/services/patentInsightApi.ts`.
  - Use the same API base URL resolution pattern as `patentAnalysisApi.ts`.
  - Call `/api/patents/insight/statistics` and `/api/patents/insight/refresh`.
- Keep it separate from `patentAnalysisApi.ts` because this page is statistics-focused rather than list/detail-focused.
- Use typed request/response interfaces.
- Provide mock fallback data so the UI remains usable if the remote API is unavailable.

Backend reverse proxy plan:

- Add `PATENT_INSIGHT_API_URL` environment variable.
  - Default: `http://172.16.1.210:8000`
  - Add to `backend/src/config/configuration.ts`.
  - Validate with `ensureUrl()` in `backend/src/config/env.validation.ts`.
  - Add to `docker-compose.yml` and `docker-compose.dev.yml`.
- Add DTO:
  - `backend/src/patent-analysis/dto/patent-insight-statistics.dto.ts`
  - Fields:
    - `applicant?: string`
    - `from_date?: string`
    - `to_date?: string`
    - `top_n_applicant?: number`
    - `top_n_target?: number`
- Add service methods in `PatentAnalysisService` or a dedicated provider:
  - `getPatentInsightStatistics(dto)`
  - `refreshPatentInsightStatistics()`
- Add controller methods under existing `@Controller('api/patents')`:
  - `@Post('insight/statistics')`
  - `@Post('insight/refresh')`
- Use `HttpService.axiosRef.get` for `/get_all_statistics/` because the upstream endpoint rejects POST with 405.
- Use `HttpService.axiosRef.post` for `/patent_statistics_refresh/` unless the upstream contract changes.
- Apply the existing backend timeout behavior via `HTTP_TIMEOUT_MS`.
- Return upstream JSON mostly unchanged, with backend-side error normalization through existing filters.
- Do not expose the upstream host to the frontend bundle.

Request flow:

```text
PatentInsight.tsx
  -> frontend/src/services/patentInsightApi.ts
  -> POST /api/patents/insight/statistics
  -> backend PatentAnalysisController
  -> backend PatentAnalysisService
  -> GET http://172.16.1.210:8000/get_all_statistics/?applicant=...&from_date=...&to_date=...
```

Refresh flow:

```text
PatentInsight.tsx
  -> frontend/src/services/patentInsightApi.ts
  -> POST /api/patents/insight/refresh
  -> backend PatentAnalysisController
  -> backend PatentAnalysisService
  -> POST http://172.16.1.210:8000/patent_statistics_refresh/
```

## Menu And Routing

Add menu item under both full sidebar and mini sidebar:

- `Documents`
  - `Patents`
    - `My 특허 쓰기`
    - `My 특허 분석`
    - `Insight`
    - `My 특허 관리`

Routes:

- Add page route: `/patents/insight`
- Page component: `frontend/src/pages/PatentInsight.tsx`
- Breadcrumb: `Documents > Patents > Insight`

`MainLayout.tsx` updates:

- Add selected key: `patent-insight`
- Add active key under `documents` mini menu.
- Add menu item in full and mini sidebar patent submenu.

## Page Layout

Use the same broad layout conventions as `PatentAnalysisList`, `PatentAnalysisDetail`, `ReactionPredictor`, and `MyBoard`.

Base layout:

```text
Patent Insight

[Publication Date] [Applicant] [Top N Applicant] [Top N Target] [Refresh]

[Total Patent] [Filtered Patent]

Left analytics area                         Right analytics area
---------------------------------------------------------------
Patent across time                          Target x Applicant heatmap

Patent per Office | Company count

Filing language   | Patent type
```

Responsive behavior:

- Desktop and wide desktop:
  - Left area: about `58-62%`
  - Right heatmap area: about `38-42%`
  - Draggable vertical split can adjust this ratio.
- Medium width:
  - Keep split if there is enough width for heatmap labels.
  - Minimum panel widths should prevent chart labels from becoming unreadable.
- Mobile or narrow width:
  - Stack all chart sections vertically.
  - Disable split/resizer UI.

Spacing:

- Use `getPatentAnalysisLayoutPreset()` style side padding, currently `16px`.
- Avoid large hero blocks.
- Keep controls compact and scan-friendly.

## Filters

Controls:

- `Publication Date`
  - Use `DatePicker.RangePicker`.
  - Include quick presets if useful:
    - Today
    - Yesterday
    - Last week
    - Last 7 days
    - Last 30 days
    - Last 3 months
    - Last 12 months
    - Custom range
- `Applicant`
  - Use searchable `Select` or `AutoComplete`.
  - Free text should be allowed if applicant options are not available from API.
- `Top N Applicant`
  - Numeric select or stepper.
  - Suggested values: `5`, `10`, `20`, `50`.
- `Top N Target`
  - Numeric select or stepper.
  - Suggested values: `10`, `20`, `50`.
- `Refresh`
  - Triggers `patent_statistics_refresh`.
  - Use loading state and last refresh timestamp.

Data loading:

- Changing filters should not immediately spam API calls.
- Use an explicit `Apply`/`Search` button or debounce applicant input.
- Recommended: `Apply` for statistics query and separate `Refresh statistics` for daily refresh.

## Chart Components

The project already uses ECharts (`echarts`, `echarts-for-react`, `echarts-gl`), so use ECharts for consistency.

Recommended components:

- `PatentInsightMetricCard`
  - For `total_count` and `filtered_count`.
- `PatentInsightLineChart`
  - `count_across_time`
  - x-axis: year
  - y-axis: count
- `PatentInsightBarChart`
  - Reusable horizontal bar for `patent_per_office` and `patent_type_counts`.
- `PatentInsightDonutChart`
  - `filling_language_counts`
- `PatentInsightApplicantTable`
  - `patent_count_by_applicant`
  - Use AntD Table with compact density.
- `PatentInsightHeatmap`
  - `patent_count_by_target_and_applicant`
  - x-axis likely year or applicant depending actual payload shape.
  - y-axis target.
  - Use visualMap on the right, matching the sketch.

Card behavior:

- Cards should have stable min-height.
- Titles should be short and aligned consistently.
- Use tooltips for chart values.
- Avoid nested cards.
- Add loading and empty states per chart.

## Power BI Style Resizing Analysis

### What is feasible now

There are two resizing levels to consider.

1. Page-level split resizing
   - Feasible immediately.
   - The project already has working patterns in:
     - `MyBoard.tsx`
     - `SynthesisBoard.tsx`
     - `PatentAnalysisDetail.tsx`
   - These use:
     - `splitRatio`
     - `mousemove` / `mouseup`
     - `requestAnimationFrame`
     - `document.body.style.cursor = 'col-resize'`
     - localStorage persistence
   - This pattern should be reused for the left analytics area and right heatmap area.

2. Individual chart tile resizing like Power BI
   - Feasible, but it is a separate dashboard-layout feature.
   - It requires managing layout metadata for every chart tile:
     - `x`
     - `y`
     - `w`
     - `h`
     - `minW`
     - `minH`
   - It also requires chart resize synchronization after tile dimensions change.
   - ECharts can handle this if the React wrapper is remounted or `chart.resize()` is called after the tile size changes.

### Recommended implementation path

Phase 1 should implement only page-level split resizing:

- User can drag the vertical divider between the summary/chart grid and the heatmap.
- Store ratio in localStorage:
  - key suggestion: `patent-insight-split-ratio`
- Keyboard support:
  - Arrow left/right adjusts by 2%.
  - Home/End moves to min/max.
  - Enter resets to default.
- Disable on stacked/mobile layout.

Phase 2 can implement chart tile resizing:

- Add an optional `Edit layout` mode.
- In normal mode, charts are static and optimized for reading.
- In edit mode:
  - Show resize handles on chart tile edges/corners.
  - Allow resizing with mouse.
  - Store layout in localStorage or user preferences later.
  - Add `Reset layout` action.

### Why not implement tile resizing immediately

Power BI-style freeform resizing has UX and engineering costs:

- It can easily produce unreadable labels in dense charts, especially heatmaps.
- Dragging inside charts conflicts with ECharts tooltip/zoom/brush interactions.
- Mobile behavior needs a separate layout.
- Persistence and reset behavior must be clear.
- It needs min size rules per chart type.

For this project, a controlled resizable split plus fixed chart grid is the safer first implementation. It gives the user the main Power BI-like control, while keeping the dashboard readable and consistent with existing app patterns.

### Technical design for tile resizing if approved

Data model:

```ts
type PatentInsightTileId =
  | 'summary'
  | 'countAcrossTime'
  | 'patentPerOffice'
  | 'applicantCount'
  | 'filingLanguage'
  | 'patentType'
  | 'targetApplicantHeatmap';

type PatentInsightTileLayout = {
  id: PatentInsightTileId;
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
  minColSpan: number;
  minRowSpan: number;
};
```

Implementation options:

- Custom CSS grid with resize handles.
  - Pros: no new dependency, full styling control, fits current codebase.
  - Cons: more implementation work for collision/reflow rules.
- Add a grid layout library later.
  - Pros: faster freeform layout.
  - Cons: dependency review needed, visual polish and bundle impact must be checked.

Recommended if implemented:

- Start with custom handles for vertical/horizontal resizing only.
- Avoid free drag/reordering at first.
- Use discrete grid units instead of pixel-perfect resizing.
- Persist only valid layouts.
- Call ECharts resize after layout changes via `ResizeObserver`.

## State Management

Local component state:

- filters
- loading/error
- statistics response
- split ratio

Persisted UI state:

- split ratio
- optional chart layout if Phase 2 is implemented
- last filter values if users expect the dashboard to reopen in the same state

Suggested localStorage keys:

- `patent-insight-filters`
- `patent-insight-split-ratio`
- `patent-insight-tile-layout`

## Dark And Light Mode

Use AntD theme tokens and CSS variables instead of hard-coded chart colors where possible.

Charts:

- Light mode:
  - Blue scale can be used for heatmap as shown in the sketch.
  - Keep surrounding UI neutral.
- Dark mode:
  - Use darker chart background from `token.colorBgContainer`.
  - Grid lines should use `token.colorBorderSecondary`.
  - Text labels should use `token.colorTextSecondary`.
  - Heatmap color scale needs enough contrast and should not look like disabled UI.

## Empty, Loading, And Error States

- Initial loading:
  - Skeleton metric cards and chart skeleton areas.
- Empty response:
  - Per-card `Empty` state with short message.
- API error:
  - Top-level `Alert`.
  - Keep mock fallback optional during prototype stage.
- Refresh running:
  - Disable refresh button.
  - Show progress text such as `Refreshing statistics...`.

## Implementation Steps

1. Create `docs/patent_insight_ui_ux_plan.md`.
2. Add `PatentInsight.tsx` page scaffold.
3. Add route `/patents/insight`.
4. Add sidebar menu item under `Documents > Patents`.
5. Add `patentInsightApi.ts` with typed API calls.
6. Add mock statistics data for offline UI development.
7. Build filter toolbar.
8. Build metric cards.
9. Build ECharts line, bar, donut, table, and heatmap sections.
10. Add page-level split resizing between left analytics area and right heatmap.
11. Add responsive stacked layout.
12. Add loading/error/empty states.
13. Add dark/light chart theme handling.
14. Document implementation details in `docs/reports/2026/06/report_20260601.md`.

## Open Questions

- Should `Refresh statistics` be visible to all users or only admin/data-owner users?
- Does `applicant` need exact matching, fuzzy matching, or multi-select?
- What is the exact shape of `patent_count_by_target_and_applicant`?
- Should the heatmap x-axis be year, applicant, or both depending filters?
- Should dashboard layout customization be saved per user in backend later?
