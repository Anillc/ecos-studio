# SoC Template Gallery Design

## Summary

Add a first-pass SoC template flow starting from `ecos/gui/apps/renderer/src/views/ECOSView.vue`:

1. The Home page `SoC / RetroSoC` card becomes clickable.
2. Clicking it navigates to a dedicated **SoC Template Manager** route.
3. Selecting the fixed `ysyxSoCASIC` template opens a dedicated **template detail** route.
4. The detail view uses `DrawingArea.vue` as the host surface, while the actual SoC preview rendering logic is extracted into separate SoC-specific modules and components.
5. The detail view shows template metadata plus selected-core properties.

The chosen UI direction is **Option 2: Gallery / Product Style** from the temporary preview:

- Preview artifact: `docs/mockups/2026-04-28-soc-ui-preview.html`
- Selected direction: gallery-style template list + ribbon-style detail summary + central drawing canvas + side inspector

This first pass intentionally uses the fixed file `ecos/gui/apps/renderer/public/ysyxSoCASIC.json` instead of module-path import scanning.

## Problem

The current `ECOSView.vue` Home screen shows `SoC / RetroSoC` as a disabled "Coming Soon" card. That blocks the entire SoC template workflow:

- Users cannot enter a SoC template list from the Home page.
- There is no management surface for SoC templates.
- There is no detail page for inspecting one template.
- The fixed JSON data already exists, but there is no UI path that exposes it.
- Selected-core inspection is not yet available outside the workspace editor flow.

At the same time, the request is explicitly design-first. The first deliverable is a clean, understandable UI that can later absorb more templates and dynamic import behavior without rewriting the overall flow.

## Goals

- Turn the `SoC / RetroSoC` card on the Home page into a working entry.
- Add dedicated routes for the SoC gallery and SoC detail screens.
- Keep `ECOSView.vue` as the Home entry point, but move SoC gallery/detail UI into dedicated route views.
- Use `ysyxSoCASIC.json` as the single source for the first template.
- Present a gallery-style template manager that looks intentional even with one template.
- Provide a template detail screen with:
  - a `DrawingArea.vue`-hosted SoC visualization
  - template-level info
  - `io_pins` count
  - selected-core info: `id`, `info`, `align`, `bounding box`
- Keep the detail page read-only in the first pass.
- Preserve room for future expansion to multiple templates and module-path import loading.
- Keep SoC rendering logic out of `DrawingArea.vue` itself.

## Non-Goals

- Do not implement module-path scanning or dynamic template discovery in the first pass.
- Do not turn the SoC detail view into a full editing workspace.
- Do not integrate placement, routing, tile generation, or DRC flows into this screen.
- Do not redesign the rest of `ECOSView` beyond what is needed to support the SoC flow.
- Do not hardcode SoC drawing behavior directly into `DrawingArea.vue`.

## Chosen Direction

Use the **Gallery / Product Style** direction:

- The Home `SoC` card becomes an entry point.
- After clicking, the router enters a gallery-like template manager page.
- The manager highlights the available template with a large preview card and compact metadata badges.
- The detail page uses a top summary ribbon, a central `DrawingArea.vue` host area, and a right-side inspector.
- Core selection is supported both from the drawing canvas and from a compact core selection rail.
- The SoC preview scene is implemented outside `DrawingArea.vue` and mounted into or alongside it through an extracted component boundary.

This direction was chosen because it balances clarity and polish:

- It feels more finished than a plain engineering table.
- It still leaves the drawing canvas as the dominant detail-page surface.
- It scales naturally when more templates are added later.

## Information Architecture

### Route Model

Use dedicated welcome-scope routes instead of local `ECOSView.vue` view state:

- `/`
- `/soc`
- `/soc/:templateId`

These routes should live under the existing `WelcomeView.vue` route tree so the SoC experience keeps the same top-level shell and TopBar behavior as the rest of the welcome-area pages.

Recommended router additions:

```ts
{
  path: '/',
  component: () => import('../views/WelcomeView.vue'),
  children: [
    { path: '', name: 'ECOS', component: () => import('../views/ECOSView.vue') },
    { path: 'soc', name: 'SoCGallery', component: () => import('../views/SoCTemplateGalleryView.vue'), meta: { title: 'SoC Template Manager' } },
    { path: 'soc/:templateId', name: 'SoCTemplateDetail', component: () => import('../views/SoCTemplateDetailView.vue'), props: true, meta: { title: 'SoC Template Detail' } },
  ],
}
```

This gives the SoC flow:

- direct deep-linkability
- cleaner back/forward navigation
- clearer separation between Home, template list, and template detail

### Home Level

The existing Home page remains the root surface:

- `Frontend Design`
- `SoC`
- `Backend Design`

Only the `SoC / RetroSoC` card changes from disabled to active, and its primary action becomes `router.push('/soc')`.

### SoC Gallery Level

The gallery level represents the temporary "SoC Template Manager" screen:

- page header with back-to-home action
- one featured template card for `ysyxSoCASIC`
- fixed-source badge to make the temporary loading mode explicit
- summary metrics such as core count and I/O count

### SoC Detail Level

The detail level represents one selected template:

- top ribbon with template summary
- central drawing area
- right inspector for template and selected-core metadata
- compact bottom or inline core rail for fast switching

## User Flow

### Entry

1. User lands on `ECOSView`.
2. User clicks the `SoC / RetroSoC` card.
3. The router navigates to `/soc`.

### Template Selection

1. The gallery route loads the fixed `ysyxSoCASIC` summary.
2. User clicks `Open Details` or the template card primary action.
3. The router navigates to `/soc/ysyxSoCASIC`.

### Core Inspection

1. The detail page selects a default core after data load.
2. User clicks a core in the drawing canvas or core rail.
3. The selected core is highlighted in the canvas.
4. The inspector updates its fields immediately.

### Navigation Back

- From `/soc`, user can go back to `/`.
- From `/soc/:templateId`, user can go back to `/soc`.

## Data Model

### Fixed Source

The first pass reads from the fixed file:

- `public/ysyxSoCASIC.json`

The screen should visually label this as a temporary fixed source, so users do not assume the import-by-path flow is already active.

## Template Mapping

The raw JSON should be normalized into a local front-end shape. Expected source fields:

- top-level:
  - `design_name`
  - `die`
  - `core`
  - `io_pins.number`
  - `cores.number`
  - `cores.list`
- per core:
  - `core_id`
  - `name`
  - `info`
  - `io_align`
  - `orient`
  - `bounding_box`

Recommended mapped shape:

```ts
type SocTemplateRect = {
  llx: number
  lly: number
  urx: number
  ury: number
  width: number
  height: number
  area?: number
}

type SocTemplateSummary = {
  id: string
  name: string
  info: string
  ioPinsCount: number
  coreCount: number
  sourceLabel: string
}

type SocTemplateCore = {
  id: number
  name: string
  info: string
  align: string
  orient: string
  boundingBox: SocTemplateRect
}

type SocTemplateDetail = SocTemplateSummary & {
  die: SocTemplateRect
  coreArea: SocTemplateRect
  cores: SocTemplateCore[]
}
```

### Fallback Rules

- If template-level `info` is missing, show `No info provided`.
- If core-level `info` is empty, also show `No info provided`.
- If a core lacks a valid bounding box, that core is omitted from canvas hit targets but may still appear in the text list with a degraded state label.

## Layout

### Home Card Update

The `SoC / RetroSoC` card in `ECOSView.vue` should:

- remove the disabled overlay
- use the same hover language as other active cards
- keep the existing visual family of the Home screen
- optionally show a small `Preview` or `Fixed JSON` badge
- navigate with `router.push('/soc')`

### Gallery Screen

The chosen gallery layout should include:

1. Back button to Home
2. Page title: `SoC Template Manager`
3. Context note such as `Fixed data source: ysyxSoCASIC.json`
4. Featured template card:
   - mini SoC preview
   - template name
   - tags: `RetroSoC`, `ASIC`, `Fixed JSON`
   - metrics: `I/O Pins`, `Cores`
   - primary CTA: `Open Details`

Even with one template, this screen should feel deliberate rather than empty.

### Detail Screen

The chosen detail layout should include:

1. Back button to gallery
2. Summary ribbon:
   - template name
   - I/O pin count
   - template info
   - optional source badge
3. Main content split:
   - left / center: `DrawingArea.vue` host surface + extracted SoC preview component
   - right: inspector
4. Secondary core-selection surface:
   - compact bottom chip rail

The drawing surface should remain the visual priority.

## DrawingArea Integration

### Requirement

The detail page must present the SoC preview inside the visual area associated with `DrawingArea.vue`, but the SoC rendering logic itself must not be implemented directly inside `DrawingArea.vue`.

### Design Direction

`DrawingArea.vue` is currently workspace-oriented, so the SoC preview should be **extracted** rather than fused into its internal logic.

Recommended shape:

- keep `DrawingArea.vue` responsible only for shared container concerns if it is reused:
  - frame
  - sizing
  - shared shell styling
  - optional generic slot/host behavior
- if the current `DrawingArea.vue` is too coupled to workspace/editor assumptions, extract those reusable host concerns into a new `DrawingAreaShell.vue` instead of extending `DrawingArea.vue` with SoC-specific behavior
- create SoC-specific modules outside `DrawingArea.vue`, for example:
  - `SoCTemplatePreviewCanvas.vue`
  - `socTemplatePreviewRenderer.ts`
  - `socTemplatePreviewSelection.ts`
- let the extracted SoC preview layer render:
  - die boundary
  - core area boundary
  - core rectangles
  - selected-core highlight
- emit selected-core changes from the SoC preview layer to the route view component

In this mode:

- `DrawingArea.vue` does not become responsible for SoC JSON parsing or SoC scene rendering
- no workspace dependency is required for the SoC preview layer
- no toolbars are shown
- no editing interactions are enabled
- only selection and fit-to-view style read-only behavior is needed

### Preferred Composition Boundary

Preferred structure for the detail route:

```vue
<SoCTemplateDetailView>
  <DrawingAreaShell>
    <SoCTemplatePreviewCanvas
      :template="template"
      :selected-core-id="selectedCoreId"
      @select-core="handleSelectCore"
    />
  </DrawingAreaShell>
</SoCTemplateDetailView>
```

If a lean shell can be provided directly by `DrawingArea.vue`, it may be reused. If not, `DrawingAreaShell.vue` should be extracted first. The important rule is that SoC rendering behavior lives in `SoCTemplatePreviewCanvas` and its helper modules, not in `DrawingArea.vue`.

### Selection Behavior

- Clicking a core selects it.
- Selected core receives a clear highlight.
- Selection is synchronized with the inspector and the core rail.
- The default selection is the first valid core in `cores.list`.

## Inspector Design

The inspector should borrow the tone of the existing property panels in the app:

- grouped sections
- compact rows
- muted labels
- monospace values for coordinates

### Template Section

Show:

- `Design`
- `Info`
- `I/O Pins`
- `Core Count`

### Selected Core Section

Show:

- `id`
- `name`
- `info`
- `align`
- `orient`
- `bounding box`

The bounding box can be displayed as one compact line in the first pass:

- `llx, lly, urx, ury`

If space allows, width and height may be shown as extra rows, but they are secondary to the requested fields.

## Interaction Model

### Loading

- Entering `soc-gallery` triggers fixed-template load if not already cached.
- Entering `soc-detail` does not refetch if the parsed template already exists in memory.

### Empty and Error States

Gallery view:

- if fixed JSON cannot be loaded, show a single high-visibility error card with retry

Detail view:

- if template detail is unavailable, show an error placeholder instead of the drawing area
- if there are zero cores, render the template summary but show an empty-state inspector

### Selection Sources

Selection can come from:

- canvas click
- core chip rail click

Both sources must update one shared `selectedCoreId`.

### Accessibility

- all interactive cards and core chips are keyboard focusable
- icon-only buttons must have labels
- selection must not rely on color alone
- heading hierarchy should remain sequential

## Component Shape

The first implementation should prefer small focused units rather than making `ECOSView.vue` absorb all details inline.

Recommended route-facing view components:

- `SoCTemplateGalleryView.vue`
- `SoCTemplateDetailView.vue`

Recommended supporting pieces:

- `SoCTemplateGallery.vue`
- `SoCTemplateDetail.vue`
- `SoCTemplateInspector.vue`
- `SoCTemplatePreviewCanvas.vue`
- `socTemplateMapper.ts`
- `socTemplatePreviewRenderer.ts`
- `socTemplatePreviewSelection.ts`

Responsibilities:

- `ECOSView.vue`
  - Home entry only
  - navigate to `/soc`
- `SoCTemplateGalleryView.vue`
  - load summary data
  - render gallery page
  - navigate to `/soc/:templateId`
- `SoCTemplateDetailView.vue`
  - read `templateId` from route params
  - load detail data
  - own `selectedCoreId`
  - connect preview canvas and inspector
- `DrawingArea.vue`
  - generic drawing host concerns only if reused
- `DrawingAreaShell.vue`
  - preferred extracted generic host if current `DrawingArea.vue` is too coupled
- `SoCTemplatePreviewCanvas.vue`
  - actual SoC scene rendering and hit testing

## Error Handling

- Failed JSON parse: show `Unable to load SoC template data`
- Missing expected fields: show a degraded but non-crashing view
- Empty `cores.list`: render summary + empty-state canvas message
- Missing `info`: replace with `No info provided`

The UI should fail soft and remain inspectable whenever possible.

## Testing

Implementation should verify:

- `ECOSView.vue` no longer renders the SoC card as a disabled placeholder
- clicking the SoC card navigates to `/soc`
- router includes `/soc` and `/soc/:templateId`
- fixed JSON data is mapped into summary and detail view models
- selecting the template navigates to `/soc/:templateId`
- selected-core state updates from canvas and rail interactions
- inspector shows `id`, `info`, `align`, and `bounding box`
- missing `info` falls back to the expected placeholder
- `DrawingArea.vue` does not own SoC-specific JSON parsing/rendering logic
- existing `ECOSView` actions like `Backend Design` and `Project Management` still behave normally

## Rollout Notes

This is intentionally a UI-first slice:

- fixed data first
- gallery flow first
- read-only detail first

Once stable, the next phase can replace the fixed-source loader with module-path import discovery without changing the main user flow or the chosen gallery/detail layout.
