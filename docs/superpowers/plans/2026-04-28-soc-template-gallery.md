# SoC Template Gallery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a routed SoC template gallery and detail flow, powered by the fixed `ysyxSoCASIC.json` dataset, with SoC preview rendering extracted out of `DrawingArea.vue`.

**Architecture:** Keep `ECOSView.vue` as the welcome-home entry, add `/soc` and `/soc/:templateId` under the existing `WelcomeView.vue` shell, and move the SoC UI into dedicated route views. Parse the fixed JSON through a small catalog/mapper layer, render the preview through an extracted `SoCTemplatePreviewCanvas.vue`, and use a lightweight `DrawingAreaShell.vue` instead of pushing SoC rendering logic into `DrawingArea.vue`.

**Tech Stack:** Vue 3 `script setup`, vue-router 4, Vitest, Vite raw-source tests, TypeScript

---

## File Structure

### Routing and Entry

- Modify: `ecos/gui/apps/renderer/src/router/index.ts`
  - Register `/soc` and `/soc/:templateId` under the existing `WelcomeView.vue` tree.
- Create: `ecos/gui/apps/renderer/src/router/index.test.ts`
  - Assert the SoC routes are registered in the welcome-shell router source.
- Modify: `ecos/gui/apps/renderer/src/views/ECOSView.vue`
  - Turn the Home `SoC / RetroSoC` card into a live route entry.
- Create: `ecos/gui/apps/renderer/src/views/ECOSView.soc-entry.test.ts`
  - Assert the SoC card now routes to `/soc`.

### Fixed Template Data

- Create: `ecos/gui/apps/renderer/src/composables/socTemplateMapper.ts`
  - Normalize raw SoC JSON into front-end summary/detail types and fallback strings.
- Create: `ecos/gui/apps/renderer/src/composables/socTemplateMapper.test.ts`
  - Verify count extraction, fallback info, and core field mapping.
- Create: `ecos/gui/apps/renderer/src/composables/socTemplateCatalog.ts`
  - Load the fixed `ysyxSoCASIC.json` asset via `fetch` and expose summary/detail helpers.
- Create: `ecos/gui/apps/renderer/src/composables/socTemplateCatalog.test.ts`
  - Verify fixed URL loading and unknown-template rejection.

### Preview Extraction

- Create: `ecos/gui/apps/renderer/src/composables/socTemplatePreviewSelection.ts`
  - Own default-core and selected-core lookup logic.
- Create: `ecos/gui/apps/renderer/src/composables/socTemplatePreviewSelection.test.ts`
  - Verify first-valid default and selected-core resolution.
- Create: `ecos/gui/apps/renderer/src/composables/socTemplatePreviewRenderer.ts`
  - Convert SoC core boxes into percentage-based preview rectangles and formatting helpers.
- Create: `ecos/gui/apps/renderer/src/composables/socTemplatePreviewRenderer.test.ts`
  - Verify preview geometry math and bounding-box formatting.
- Create: `ecos/gui/apps/renderer/src/components/DrawingAreaShell.vue`
  - Provide a generic visual host surface without editor/workspace behavior.
- Create: `ecos/gui/apps/renderer/src/components/DrawingAreaShell.test.ts`
  - Assert the shell is slot-based and editor-free.
- Create: `ecos/gui/apps/renderer/src/components/SoCTemplatePreviewCanvas.vue`
  - Render the read-only SoC preview and emit selected-core changes.
- Create: `ecos/gui/apps/renderer/src/components/SoCTemplatePreviewCanvas.test.ts`
  - Assert preview props/emits and SoC-core marker usage.

### Routed SoC UI

- Create: `ecos/gui/apps/renderer/src/components/SoCTemplateGallery.vue`
  - Render the gallery-style template manager surface.
- Create: `ecos/gui/apps/renderer/src/components/SoCTemplateGallery.test.ts`
  - Assert gallery props, `open`, `back`, and `retry` events.
- Create: `ecos/gui/apps/renderer/src/views/SoCTemplateGalleryView.vue`
  - Load fixed summaries, manage loading/error state, and route into details.
- Create: `ecos/gui/apps/renderer/src/views/SoCTemplateGalleryView.test.ts`
  - Assert loader wiring and detail navigation calls.
- Create: `ecos/gui/apps/renderer/src/components/SoCTemplateInspector.vue`
  - Render template/core metadata with fallback text and bounding-box rows.
- Create: `ecos/gui/apps/renderer/src/components/SoCTemplateInspector.test.ts`
  - Assert requested inspector fields are present.
- Create: `ecos/gui/apps/renderer/src/components/SoCTemplateDetail.vue`
  - Compose `DrawingAreaShell`, `SoCTemplatePreviewCanvas`, the inspector, and the core chip rail.
- Create: `ecos/gui/apps/renderer/src/components/SoCTemplateDetail.test.ts`
  - Assert detail composition and chip-rail markers.
- Create: `ecos/gui/apps/renderer/src/views/SoCTemplateDetailView.vue`
  - Load fixed detail data by route param, own `selectedCoreId`, and bridge preview selection to the inspector.
- Create: `ecos/gui/apps/renderer/src/views/SoCTemplateDetailView.test.ts`
  - Assert route-param loading, default selection, and detail composition.

### Scope Notes

- Do not modify `DrawingArea.vue` to parse or render SoC JSON.
- Only reuse visual-shell concerns from `DrawingArea.vue`; if that is awkward, keep `DrawingAreaShell.vue` self-contained.
- Keep the first pass fixed to `ysyxSoCASIC.json`.
- Do not add workspace dependencies to the SoC gallery/detail pages.

### Task 1: Add SoC Routes and Activate the Home Entry

**Files:**
- Create: `ecos/gui/apps/renderer/src/router/index.test.ts`
- Create: `ecos/gui/apps/renderer/src/views/ECOSView.soc-entry.test.ts`
- Modify: `ecos/gui/apps/renderer/src/router/index.ts`
- Modify: `ecos/gui/apps/renderer/src/views/ECOSView.vue`

- [ ] **Step 1: Write the failing tests**

```ts
// ecos/gui/apps/renderer/src/router/index.test.ts
import { describe, expect, it } from 'vitest'
import routerSource from './index.ts?raw'

describe('router SoC welcome routes', () => {
  it('registers the SoC gallery and detail routes under the welcome shell', () => {
    expect(routerSource).toContain("{ path: 'soc', name: 'SoCGallery'")
    expect(routerSource).toContain("{ path: 'soc/:templateId', name: 'SoCTemplateDetail'")
    expect(routerSource).toContain("component: () => import('../views/SoCTemplateGalleryView.vue')")
    expect(routerSource).toContain("component: () => import('../views/SoCTemplateDetailView.vue')")
    expect(routerSource).toContain('props: true')
  })
})
```

```ts
// ecos/gui/apps/renderer/src/views/ECOSView.soc-entry.test.ts
import { describe, expect, it } from 'vitest'
import source from './ECOSView.vue?raw'

describe('ECOSView SoC entry card', () => {
  it('routes the SoC card to /soc instead of leaving it as coming-soon chrome', () => {
    expect(source).toContain("const navigateToSoC = () => router.push('/soc')")
    expect(source).toContain('@click="navigateToSoC"')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
pnpm --filter @ecos-studio/renderer exec vitest run \
  src/router/index.test.ts \
  src/views/ECOSView.soc-entry.test.ts
```

Expected: FAIL because `/soc` routes do not exist yet and `ECOSView.vue` does not define `navigateToSoC`.

- [ ] **Step 3: Write the minimal implementation**

```ts
// ecos/gui/apps/renderer/src/router/index.ts
const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('../views/WelcomeView.vue'),
    children: [
      { path: '', name: 'ECOS', component: () => import('../views/ECOSView.vue') },
      { path: 'soc', name: 'SoCGallery', component: () => import('../views/SoCTemplateGalleryView.vue') },
      { path: 'soc/:templateId', name: 'SoCTemplateDetail', component: () => import('../views/SoCTemplateDetailView.vue'), props: true },
      { path: 'ecc', name: 'ECC', component: () => import('../views/ECCView.vue') },
      { path: 'projects', name: 'Projects', component: () => import('../views/ProjectsView.vue') },
    ],
  },
]
```

```ts
// ecos/gui/apps/renderer/src/views/ECOSView.vue
const navigateToSoC = () => router.push('/soc')
```

```vue
<!-- ecos/gui/apps/renderer/src/views/ECOSView.vue -->
<button
  @click="navigateToSoC"
  class="group flex flex-col items-center justify-center py-8 bg-(--bg-secondary) rounded-xl border border-(--border-color) hover:border-(--accent-color) transition-all duration-200 hover:scale-[1.02] cursor-pointer hover:shadow-lg hover:shadow-(--accent-color)/5"
>
  <div class="w-12 h-12 rounded-xl bg-(--bg-primary) flex items-center justify-center group-hover:bg-(--accent-color)/10 transition-colors mb-3">
    <i class="ri-cpu-line text-2xl text-(--text-secondary) group-hover:text-(--accent-color) transition-colors"></i>
  </div>
  <span class="text-sm font-medium text-(--text-primary) mb-1">SoC</span>
  <span class="text-xs text-(--text-secondary)">RetroSoC</span>
</button>
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
pnpm --filter @ecos-studio/renderer exec vitest run \
  src/router/index.test.ts \
  src/views/ECOSView.soc-entry.test.ts
```

Expected: PASS with 2 passing test files.

- [ ] **Step 5: Commit**

```bash
git add \
  ecos/gui/apps/renderer/src/router/index.ts \
  ecos/gui/apps/renderer/src/router/index.test.ts \
  ecos/gui/apps/renderer/src/views/ECOSView.vue \
  ecos/gui/apps/renderer/src/views/ECOSView.soc-entry.test.ts
git commit -m "feat(renderer): add soc welcome routes"
```

### Task 2: Add the Fixed SoC Catalog and Mapper

**Files:**
- Create: `ecos/gui/apps/renderer/src/composables/socTemplateMapper.ts`
- Create: `ecos/gui/apps/renderer/src/composables/socTemplateMapper.test.ts`
- Create: `ecos/gui/apps/renderer/src/composables/socTemplateCatalog.ts`
- Create: `ecos/gui/apps/renderer/src/composables/socTemplateCatalog.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// ecos/gui/apps/renderer/src/composables/socTemplateMapper.test.ts
import { describe, expect, it } from 'vitest'
import { normalizeSocTemplateDetail, toSocTemplateSummary } from './socTemplateMapper'

const raw = {
  design_name: 'ysyxSoCASIC',
  die: { llx: 0, lly: 0, urx: 100, ury: 100, width: 100, height: 100, area: 10000 },
  core: { llx: 10, lly: 10, urx: 90, ury: 90, width: 80, height: 80, area: 6400 },
  io_pins: { number: 58, list: [] },
  cores: {
    number: 2,
    list: [
      { core_id: 4, name: 'core4', info: '', io_align: 'left', orient: 'FN', bounding_box: { llx: 10, lly: 10, urx: 30, ury: 30, width: 20, height: 20, area: 400 } },
      { core_id: 5, name: 'core5', info: 'ok', io_align: 'right', orient: 'N', bounding_box: { llx: 50, lly: 50, urx: 70, ury: 70, width: 20, height: 20, area: 400 } },
    ],
  },
}

describe('socTemplateMapper', () => {
  it('normalizes detail data and fills missing info with a fallback', () => {
    const detail = normalizeSocTemplateDetail(raw, 'Fixed JSON')
    expect(detail.info).toBe('No info provided')
    expect(detail.ioPinsCount).toBe(58)
    expect(detail.coreCount).toBe(2)
    expect(detail.cores[0]).toMatchObject({ id: 4, align: 'left', orient: 'FN', info: 'No info provided' })
  })

  it('projects a gallery summary from the normalized detail', () => {
    const detail = normalizeSocTemplateDetail(raw, 'Fixed JSON')
    expect(toSocTemplateSummary(detail)).toMatchObject({
      id: 'ysyxSoCASIC',
      name: 'ysyxSoCASIC',
      ioPinsCount: 58,
      coreCount: 2,
      sourceLabel: 'Fixed JSON',
    })
  })
})
```

```ts
// ecos/gui/apps/renderer/src/composables/socTemplateCatalog.test.ts
import { describe, expect, it, vi } from 'vitest'
import {
  FIXED_SOC_TEMPLATE_ID,
  FIXED_SOC_TEMPLATE_URL,
  loadSocTemplateCatalog,
  loadSocTemplateDetail,
} from './socTemplateCatalog'

const responseJson = {
  design_name: 'ysyxSoCASIC',
  die: { llx: 0, lly: 0, urx: 100, ury: 100, width: 100, height: 100, area: 10000 },
  core: { llx: 10, lly: 10, urx: 90, ury: 90, width: 80, height: 80, area: 6400 },
  io_pins: { number: 58, list: [] },
  cores: { number: 0, list: [] },
}

describe('socTemplateCatalog', () => {
  it('loads the fixed public JSON and returns one gallery item', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => responseJson })
    const items = await loadSocTemplateCatalog(fetchMock)
    expect(fetchMock).toHaveBeenCalledWith(FIXED_SOC_TEMPLATE_URL)
    expect(items).toHaveLength(1)
    expect(items[0]?.id).toBe(FIXED_SOC_TEMPLATE_ID)
  })

  it('rejects unknown template ids before fetching', async () => {
    await expect(loadSocTemplateDetail('unknown-template', vi.fn() as any)).rejects.toThrow('Unknown SoC template: unknown-template')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
pnpm --filter @ecos-studio/renderer exec vitest run \
  src/composables/socTemplateMapper.test.ts \
  src/composables/socTemplateCatalog.test.ts
```

Expected: FAIL because neither mapper nor catalog modules exist yet.

- [ ] **Step 3: Write the minimal implementation**

```ts
// ecos/gui/apps/renderer/src/composables/socTemplateMapper.ts
export type SocTemplateRect = {
  llx: number
  lly: number
  urx: number
  ury: number
  width: number
  height: number
  area?: number
}

export type SocTemplateCore = {
  id: number
  name: string
  info: string
  align: string
  orient: string
  boundingBox: SocTemplateRect
}

export type SocTemplateSummary = {
  id: string
  name: string
  info: string
  ioPinsCount: number
  coreCount: number
  sourceLabel: string
}

export type SocTemplateDetail = SocTemplateSummary & {
  die: SocTemplateRect
  coreArea: SocTemplateRect
  cores: SocTemplateCore[]
}

const FALLBACK_INFO = 'No info provided'

function normalizeInfo(value: unknown): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : FALLBACK_INFO
}

export function normalizeSocTemplateDetail(raw: any, sourceLabel: string): SocTemplateDetail {
  const cores = Array.isArray(raw?.cores?.list)
    ? raw.cores.list.map((core: any) => ({
        id: Number(core?.core_id ?? -1),
        name: String(core?.name ?? 'unknown-core'),
        info: normalizeInfo(core?.info),
        align: String(core?.io_align ?? 'unknown'),
        orient: String(core?.orient ?? 'unknown'),
        boundingBox: core?.bounding_box,
      }))
    : []

  return {
    id: String(raw?.design_name ?? 'unknown-template'),
    name: String(raw?.design_name ?? 'unknown-template'),
    info: normalizeInfo(raw?.info),
    ioPinsCount: Number(raw?.io_pins?.number ?? 0),
    coreCount: Number(raw?.cores?.number ?? cores.length),
    sourceLabel,
    die: raw?.die,
    coreArea: raw?.core,
    cores,
  }
}

export function toSocTemplateSummary(detail: SocTemplateDetail): SocTemplateSummary {
  return {
    id: detail.id,
    name: detail.name,
    info: detail.info,
    ioPinsCount: detail.ioPinsCount,
    coreCount: detail.coreCount,
    sourceLabel: detail.sourceLabel,
  }
}
```

```ts
// ecos/gui/apps/renderer/src/composables/socTemplateCatalog.ts
import {
  normalizeSocTemplateDetail,
  toSocTemplateSummary,
  type SocTemplateDetail,
  type SocTemplateSummary,
} from './socTemplateMapper'

export const FIXED_SOC_TEMPLATE_ID = 'ysyxSoCASIC'
export const FIXED_SOC_TEMPLATE_URL = '/ysyxSoCASIC.json'

type FetchLike = (input: string) => Promise<{ ok: boolean; json(): Promise<unknown> }>

export async function loadSocTemplateDetail(templateId: string, fetchImpl: FetchLike = fetch as FetchLike): Promise<SocTemplateDetail> {
  if (templateId !== FIXED_SOC_TEMPLATE_ID) {
    throw new Error(`Unknown SoC template: ${templateId}`)
  }

  const response = await fetchImpl(FIXED_SOC_TEMPLATE_URL)
  if (!response.ok) {
    throw new Error(`Unable to load SoC template data: ${templateId}`)
  }

  return normalizeSocTemplateDetail(await response.json(), 'Fixed JSON')
}

export async function loadSocTemplateCatalog(fetchImpl: FetchLike = fetch as FetchLike): Promise<SocTemplateSummary[]> {
  const detail = await loadSocTemplateDetail(FIXED_SOC_TEMPLATE_ID, fetchImpl)
  return [toSocTemplateSummary(detail)]
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
pnpm --filter @ecos-studio/renderer exec vitest run \
  src/composables/socTemplateMapper.test.ts \
  src/composables/socTemplateCatalog.test.ts
```

Expected: PASS with 4 passing tests.

- [ ] **Step 5: Commit**

```bash
git add \
  ecos/gui/apps/renderer/src/composables/socTemplateMapper.ts \
  ecos/gui/apps/renderer/src/composables/socTemplateMapper.test.ts \
  ecos/gui/apps/renderer/src/composables/socTemplateCatalog.ts \
  ecos/gui/apps/renderer/src/composables/socTemplateCatalog.test.ts
git commit -m "feat(renderer): add fixed soc template catalog"
```

### Task 3: Add Preview Selection and Geometry Helpers

**Files:**
- Create: `ecos/gui/apps/renderer/src/composables/socTemplatePreviewSelection.ts`
- Create: `ecos/gui/apps/renderer/src/composables/socTemplatePreviewSelection.test.ts`
- Create: `ecos/gui/apps/renderer/src/composables/socTemplatePreviewRenderer.ts`
- Create: `ecos/gui/apps/renderer/src/composables/socTemplatePreviewRenderer.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// ecos/gui/apps/renderer/src/composables/socTemplatePreviewSelection.test.ts
import { describe, expect, it } from 'vitest'
import type { SocTemplateDetail } from './socTemplateMapper'
import { getDefaultSocCoreId, getSelectedSocCore } from './socTemplatePreviewSelection'

const template = {
  id: 'demo',
  name: 'demo',
  info: 'No info provided',
  ioPinsCount: 0,
  coreCount: 2,
  sourceLabel: 'Fixed JSON',
  die: { llx: 0, lly: 0, urx: 100, ury: 100, width: 100, height: 100 },
  coreArea: { llx: 0, lly: 0, urx: 100, ury: 100, width: 100, height: 100 },
  cores: [
    { id: 8, name: 'core8', info: 'No info provided', align: 'left', orient: 'N', boundingBox: { llx: 10, lly: 10, urx: 30, ury: 30, width: 20, height: 20 } },
    { id: 9, name: 'core9', info: 'ok', align: 'right', orient: 'FN', boundingBox: { llx: 40, lly: 40, urx: 60, ury: 60, width: 20, height: 20 } },
  ],
} satisfies SocTemplateDetail

describe('socTemplatePreviewSelection', () => {
  it('uses the first valid core as the default selection', () => {
    expect(getDefaultSocCoreId(template)).toBe(8)
  })

  it('resolves the selected core by id and falls back to null when missing', () => {
    expect(getSelectedSocCore(template, 9)?.name).toBe('core9')
    expect(getSelectedSocCore(template, 999)).toBeNull()
  })
})
```

```ts
// ecos/gui/apps/renderer/src/composables/socTemplatePreviewRenderer.test.ts
import { describe, expect, it } from 'vitest'
import type { SocTemplateDetail } from './socTemplateMapper'
import { buildSocPreviewRects, formatSocBoundingBox } from './socTemplatePreviewRenderer'

const template = {
  id: 'demo',
  name: 'demo',
  info: 'No info provided',
  ioPinsCount: 0,
  coreCount: 1,
  sourceLabel: 'Fixed JSON',
  die: { llx: 0, lly: 0, urx: 100, ury: 100, width: 100, height: 100 },
  coreArea: { llx: 0, lly: 0, urx: 100, ury: 100, width: 100, height: 100 },
  cores: [
    { id: 1, name: 'core1', info: 'No info provided', align: 'left', orient: 'N', boundingBox: { llx: 10, lly: 60, urx: 30, ury: 80, width: 20, height: 20 } },
  ],
} satisfies SocTemplateDetail

describe('socTemplatePreviewRenderer', () => {
  it('projects core boxes into percentage-based preview rects', () => {
    expect(buildSocPreviewRects(template)).toEqual([
      expect.objectContaining({
        coreId: 1,
        label: 'core1',
        leftPct: 10,
        topPct: 20,
        widthPct: 20,
        heightPct: 20,
      }),
    ])
  })

  it('formats the bounding box line for the inspector', () => {
    expect(formatSocBoundingBox(template.cores[0]!.boundingBox)).toBe('10, 60, 30, 80')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
pnpm --filter @ecos-studio/renderer exec vitest run \
  src/composables/socTemplatePreviewSelection.test.ts \
  src/composables/socTemplatePreviewRenderer.test.ts
```

Expected: FAIL because preview helper modules do not exist yet.

- [ ] **Step 3: Write the minimal implementation**

```ts
// ecos/gui/apps/renderer/src/composables/socTemplatePreviewSelection.ts
import type { SocTemplateCore, SocTemplateDetail } from './socTemplateMapper'

export function getDefaultSocCoreId(template: SocTemplateDetail): number | null {
  return template.cores[0]?.id ?? null
}

export function getSelectedSocCore(template: SocTemplateDetail, selectedCoreId: number | null): SocTemplateCore | null {
  if (selectedCoreId == null) return null
  return template.cores.find(core => core.id === selectedCoreId) ?? null
}
```

```ts
// ecos/gui/apps/renderer/src/composables/socTemplatePreviewRenderer.ts
import type { SocTemplateDetail, SocTemplateRect } from './socTemplateMapper'

export type SocPreviewRect = {
  coreId: number
  label: string
  leftPct: number
  topPct: number
  widthPct: number
  heightPct: number
  align: string
  orient: string
}

export function buildSocPreviewRects(template: SocTemplateDetail): SocPreviewRect[] {
  return template.cores.map((core) => ({
    coreId: core.id,
    label: core.name.split('/').pop() ?? core.name,
    leftPct: ((core.boundingBox.llx - template.coreArea.llx) / template.coreArea.width) * 100,
    topPct: ((template.coreArea.ury - core.boundingBox.ury) / template.coreArea.height) * 100,
    widthPct: (core.boundingBox.width / template.coreArea.width) * 100,
    heightPct: (core.boundingBox.height / template.coreArea.height) * 100,
    align: core.align,
    orient: core.orient,
  }))
}

export function formatSocBoundingBox(box: SocTemplateRect): string {
  return `${box.llx}, ${box.lly}, ${box.urx}, ${box.ury}`
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
pnpm --filter @ecos-studio/renderer exec vitest run \
  src/composables/socTemplatePreviewSelection.test.ts \
  src/composables/socTemplatePreviewRenderer.test.ts
```

Expected: PASS with 4 passing tests.

- [ ] **Step 5: Commit**

```bash
git add \
  ecos/gui/apps/renderer/src/composables/socTemplatePreviewSelection.ts \
  ecos/gui/apps/renderer/src/composables/socTemplatePreviewSelection.test.ts \
  ecos/gui/apps/renderer/src/composables/socTemplatePreviewRenderer.ts \
  ecos/gui/apps/renderer/src/composables/socTemplatePreviewRenderer.test.ts
git commit -m "feat(renderer): add soc preview helpers"
```

### Task 4: Extract the Drawing Host Shell and Preview Canvas

**Files:**
- Create: `ecos/gui/apps/renderer/src/components/DrawingAreaShell.vue`
- Create: `ecos/gui/apps/renderer/src/components/DrawingAreaShell.test.ts`
- Create: `ecos/gui/apps/renderer/src/components/SoCTemplatePreviewCanvas.vue`
- Create: `ecos/gui/apps/renderer/src/components/SoCTemplatePreviewCanvas.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// ecos/gui/apps/renderer/src/components/DrawingAreaShell.test.ts
import { describe, expect, it } from 'vitest'
import source from './DrawingAreaShell.vue?raw'

describe('DrawingAreaShell', () => {
  it('provides a slot-based generic host without importing the workspace editor stack', () => {
    expect(source).toContain('<slot />')
    expect(source).toContain('drawing-area-shell')
    expect(source).not.toContain("@/applications/editor")
  })
})
```

```ts
// ecos/gui/apps/renderer/src/components/SoCTemplatePreviewCanvas.test.ts
import { describe, expect, it } from 'vitest'
import source from './SoCTemplatePreviewCanvas.vue?raw'

describe('SoCTemplatePreviewCanvas', () => {
  it('accepts template data, tracks the selected core, and emits select-core', () => {
    expect(source).toContain('selectedCoreId: number | null')
    expect(source).toContain("select-core: [coreId: number]")
    expect(source).toContain('buildSocPreviewRects')
    expect(source).toContain('data-soc-core-id')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
pnpm --filter @ecos-studio/renderer exec vitest run \
  src/components/DrawingAreaShell.test.ts \
  src/components/SoCTemplatePreviewCanvas.test.ts
```

Expected: FAIL because both new components are missing.

- [ ] **Step 3: Write the minimal implementation**

```vue
<!-- ecos/gui/apps/renderer/src/components/DrawingAreaShell.vue -->
<template>
  <section class="drawing-area-shell">
    <div class="drawing-area-shell__body">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.drawing-area-shell {
  height: 100%;
  min-height: 420px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 18px;
  overflow: hidden;
}

.drawing-area-shell__body {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 420px;
  background:
    linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px),
    var(--bg-primary);
  background-size: 24px 24px;
}
</style>
```

```vue
<!-- ecos/gui/apps/renderer/src/components/SoCTemplatePreviewCanvas.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { buildSocPreviewRects } from '@/composables/socTemplatePreviewRenderer'
import type { SocTemplateDetail } from '@/composables/socTemplateMapper'

const props = defineProps<{
  template: SocTemplateDetail
  selectedCoreId: number | null
}>()

const emit = defineEmits<{
  'select-core': [coreId: number]
}>()

const rects = computed(() => buildSocPreviewRects(props.template))
</script>

<template>
  <div class="soc-template-preview-canvas">
    <div class="soc-template-preview-canvas__die">
      <div class="soc-template-preview-canvas__core-area">
        <button
          v-for="rect in rects"
          :key="rect.coreId"
          type="button"
          class="soc-template-preview-canvas__core"
          :class="{ 'is-selected': rect.coreId === selectedCoreId }"
          :data-soc-core-id="rect.coreId"
          :style="{
            left: `${rect.leftPct}%`,
            top: `${rect.topPct}%`,
            width: `${rect.widthPct}%`,
            height: `${rect.heightPct}%`,
          }"
          @click="emit('select-core', rect.coreId)"
        >
          <span>{{ rect.label }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
pnpm --filter @ecos-studio/renderer exec vitest run \
  src/components/DrawingAreaShell.test.ts \
  src/components/SoCTemplatePreviewCanvas.test.ts
```

Expected: PASS with 2 passing tests.

- [ ] **Step 5: Commit**

```bash
git add \
  ecos/gui/apps/renderer/src/components/DrawingAreaShell.vue \
  ecos/gui/apps/renderer/src/components/DrawingAreaShell.test.ts \
  ecos/gui/apps/renderer/src/components/SoCTemplatePreviewCanvas.vue \
  ecos/gui/apps/renderer/src/components/SoCTemplatePreviewCanvas.test.ts
git commit -m "feat(renderer): extract soc preview canvas shell"
```

### Task 5: Build the Routed Gallery Screen

**Files:**
- Create: `ecos/gui/apps/renderer/src/components/SoCTemplateGallery.vue`
- Create: `ecos/gui/apps/renderer/src/components/SoCTemplateGallery.test.ts`
- Create: `ecos/gui/apps/renderer/src/views/SoCTemplateGalleryView.vue`
- Create: `ecos/gui/apps/renderer/src/views/SoCTemplateGalleryView.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// ecos/gui/apps/renderer/src/components/SoCTemplateGallery.test.ts
import { describe, expect, it } from 'vitest'
import source from './SoCTemplateGallery.vue?raw'

describe('SoCTemplateGallery', () => {
  it('exposes gallery items and emits back/open/retry events', () => {
    expect(source).toContain('items: SocTemplateSummary[]')
    expect(source).toContain("open: [templateId: string]")
    expect(source).toContain("back: []")
    expect(source).toContain("retry: []")
  })
})
```

```ts
// ecos/gui/apps/renderer/src/views/SoCTemplateGalleryView.test.ts
import { describe, expect, it } from 'vitest'
import source from './SoCTemplateGalleryView.vue?raw'

describe('SoCTemplateGalleryView', () => {
  it('loads the fixed catalog and routes into the detail page', () => {
    expect(source).toContain('loadSocTemplateCatalog')
    expect(source).toContain("router.push({ name: 'SoCTemplateDetail'")
    expect(source).toContain('<SoCTemplateGallery')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
pnpm --filter @ecos-studio/renderer exec vitest run \
  src/components/SoCTemplateGallery.test.ts \
  src/views/SoCTemplateGalleryView.test.ts
```

Expected: FAIL because the gallery component and route view do not exist yet.

- [ ] **Step 3: Write the minimal implementation**

```vue
<!-- ecos/gui/apps/renderer/src/components/SoCTemplateGallery.vue -->
<script setup lang="ts">
import type { SocTemplateSummary } from '@/composables/socTemplateMapper'

defineProps<{
  items: SocTemplateSummary[]
  loading: boolean
  error: string | null
}>()

defineEmits<{
  back: []
  open: [templateId: string]
  retry: []
}>()
</script>

<template>
  <section class="soc-template-gallery">
    <header class="soc-template-gallery__header">
      <button type="button" @click="$emit('back')">Back</button>
      <div>
        <h1>SoC Template Manager</h1>
        <p>Fixed data source: ysyxSoCASIC.json</p>
      </div>
    </header>

    <div v-if="loading">Loading template catalog…</div>
    <div v-else-if="error">
      <p>{{ error }}</p>
      <button type="button" @click="$emit('retry')">Retry</button>
    </div>
    <article v-else v-for="item in items" :key="item.id" class="soc-template-gallery__card">
      <h2>{{ item.name }}</h2>
      <p>{{ item.info }}</p>
      <div>{{ item.ioPinsCount }} IO Pins · {{ item.coreCount }} Cores</div>
      <button type="button" @click="$emit('open', item.id)">Open Details</button>
    </article>
  </section>
</template>
```

```vue
<!-- ecos/gui/apps/renderer/src/views/SoCTemplateGalleryView.vue -->
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import SoCTemplateGallery from '@/components/SoCTemplateGallery.vue'
import { loadSocTemplateCatalog } from '@/composables/socTemplateCatalog'
import type { SocTemplateSummary } from '@/composables/socTemplateMapper'

const router = useRouter()
const items = ref<SocTemplateSummary[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

async function loadCatalog(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    items.value = await loadSocTemplateCatalog()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unable to load SoC template data'
  } finally {
    loading.value = false
  }
}

function handleOpen(templateId: string): void {
  router.push({ name: 'SoCTemplateDetail', params: { templateId } })
}

onMounted(loadCatalog)
</script>

<template>
  <SoCTemplateGallery
    :items="items"
    :loading="loading"
    :error="error"
    @back="router.push('/')"
    @open="handleOpen"
    @retry="loadCatalog"
  />
</template>
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
pnpm --filter @ecos-studio/renderer exec vitest run \
  src/components/SoCTemplateGallery.test.ts \
  src/views/SoCTemplateGalleryView.test.ts
```

Expected: PASS with 2 passing tests.

- [ ] **Step 5: Commit**

```bash
git add \
  ecos/gui/apps/renderer/src/components/SoCTemplateGallery.vue \
  ecos/gui/apps/renderer/src/components/SoCTemplateGallery.test.ts \
  ecos/gui/apps/renderer/src/views/SoCTemplateGalleryView.vue \
  ecos/gui/apps/renderer/src/views/SoCTemplateGalleryView.test.ts
git commit -m "feat(renderer): add soc template gallery screen"
```

### Task 6: Build the Routed Detail Screen and Inspector

**Files:**
- Create: `ecos/gui/apps/renderer/src/components/SoCTemplateInspector.vue`
- Create: `ecos/gui/apps/renderer/src/components/SoCTemplateInspector.test.ts`
- Create: `ecos/gui/apps/renderer/src/components/SoCTemplateDetail.vue`
- Create: `ecos/gui/apps/renderer/src/components/SoCTemplateDetail.test.ts`
- Create: `ecos/gui/apps/renderer/src/views/SoCTemplateDetailView.vue`
- Create: `ecos/gui/apps/renderer/src/views/SoCTemplateDetailView.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// ecos/gui/apps/renderer/src/components/SoCTemplateInspector.test.ts
import { describe, expect, it } from 'vitest'
import source from './SoCTemplateInspector.vue?raw'

describe('SoCTemplateInspector', () => {
  it('renders the requested template and core fields with fallback info', () => {
    expect(source).toContain('I/O Pins')
    expect(source).toContain('align')
    expect(source).toContain('bounding box')
    expect(source).toContain('No info provided')
  })
})
```

```ts
// ecos/gui/apps/renderer/src/components/SoCTemplateDetail.test.ts
import { describe, expect, it } from 'vitest'
import source from './SoCTemplateDetail.vue?raw'

describe('SoCTemplateDetail', () => {
  it('composes the shell, preview canvas, inspector, and core chip rail', () => {
    expect(source).toContain('DrawingAreaShell')
    expect(source).toContain('SoCTemplatePreviewCanvas')
    expect(source).toContain('SoCTemplateInspector')
    expect(source).toContain('data-soc-core-chip')
  })
})
```

```ts
// ecos/gui/apps/renderer/src/views/SoCTemplateDetailView.test.ts
import { describe, expect, it } from 'vitest'
import source from './SoCTemplateDetailView.vue?raw'

describe('SoCTemplateDetailView', () => {
  it('loads detail data by route param and seeds the default selected core', () => {
    expect(source).toContain('templateId: string')
    expect(source).toContain('loadSocTemplateDetail')
    expect(source).toContain('getDefaultSocCoreId')
    expect(source).toContain('<SoCTemplateDetail')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
pnpm --filter @ecos-studio/renderer exec vitest run \
  src/components/SoCTemplateInspector.test.ts \
  src/components/SoCTemplateDetail.test.ts \
  src/views/SoCTemplateDetailView.test.ts
```

Expected: FAIL because the detail route UI does not exist yet.

- [ ] **Step 3: Write the minimal implementation**

```vue
<!-- ecos/gui/apps/renderer/src/components/SoCTemplateInspector.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { formatSocBoundingBox } from '@/composables/socTemplatePreviewRenderer'
import type { SocTemplateCore, SocTemplateDetail } from '@/composables/socTemplateMapper'

const props = defineProps<{
  template: SocTemplateDetail
  selectedCore: SocTemplateCore | null
}>()

const selectedInfo = computed(() => props.selectedCore?.info || 'No info provided')
</script>

<template>
  <aside class="soc-template-inspector">
    <section>
      <h3>Template</h3>
      <div>Design: {{ template.name }}</div>
      <div>Info: {{ template.info }}</div>
      <div>I/O Pins: {{ template.ioPinsCount }}</div>
      <div>Core Count: {{ template.coreCount }}</div>
    </section>

    <section>
      <h3>Selected Core</h3>
      <div v-if="selectedCore">
        <div>id: {{ selectedCore.id }}</div>
        <div>name: {{ selectedCore.name }}</div>
        <div>info: {{ selectedInfo }}</div>
        <div>align: {{ selectedCore.align }}</div>
        <div>orient: {{ selectedCore.orient }}</div>
        <div>bounding box: {{ formatSocBoundingBox(selectedCore.boundingBox) }}</div>
      </div>
      <div v-else>No core selected</div>
    </section>
  </aside>
</template>
```

```vue
<!-- ecos/gui/apps/renderer/src/components/SoCTemplateDetail.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import DrawingAreaShell from '@/components/DrawingAreaShell.vue'
import SoCTemplateInspector from '@/components/SoCTemplateInspector.vue'
import SoCTemplatePreviewCanvas from '@/components/SoCTemplatePreviewCanvas.vue'
import { getSelectedSocCore } from '@/composables/socTemplatePreviewSelection'
import type { SocTemplateDetail as SocTemplateDetailModel } from '@/composables/socTemplateMapper'

const props = defineProps<{
  template: SocTemplateDetailModel
  selectedCoreId: number | null
}>()

const emit = defineEmits<{
  back: []
  'select-core': [coreId: number]
}>()

const selectedCore = computed(() => getSelectedSocCore(props.template, props.selectedCoreId))
</script>

<template>
  <section class="soc-template-detail">
    <header>
      <button type="button" @click="$emit('back')">Back</button>
      <h1>{{ template.name }}</h1>
      <p>{{ template.ioPinsCount }} IO Pins · {{ template.info }}</p>
    </header>

    <div class="soc-template-detail__main">
      <DrawingAreaShell>
        <SoCTemplatePreviewCanvas
          :template="template"
          :selected-core-id="selectedCoreId"
          @select-core="$emit('select-core', $event)"
        />
      </DrawingAreaShell>

      <SoCTemplateInspector :template="template" :selected-core="selectedCore" />
    </div>

    <div class="soc-template-detail__chips">
      <button
        v-for="core in template.cores"
        :key="core.id"
        type="button"
        :data-soc-core-chip="core.id"
        @click="$emit('select-core', core.id)"
      >
        {{ core.name.split('/').pop() || core.name }}
      </button>
    </div>
  </section>
</template>
```

```vue
<!-- ecos/gui/apps/renderer/src/views/SoCTemplateDetailView.vue -->
<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import SoCTemplateDetail from '@/components/SoCTemplateDetail.vue'
import { loadSocTemplateDetail } from '@/composables/socTemplateCatalog'
import type { SocTemplateDetail as SocTemplateDetailModel } from '@/composables/socTemplateMapper'
import { getDefaultSocCoreId } from '@/composables/socTemplatePreviewSelection'

const props = defineProps<{
  templateId: string
}>()

const router = useRouter()
const template = ref<SocTemplateDetailModel | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const selectedCoreId = ref<number | null>(null)

async function loadDetail(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const detail = await loadSocTemplateDetail(props.templateId)
    template.value = detail
    selectedCoreId.value = getDefaultSocCoreId(detail)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unable to load SoC template data'
  } finally {
    loading.value = false
  }
}

watch(() => props.templateId, loadDetail, { immediate: true })
</script>

<template>
  <div v-if="loading">Loading template detail…</div>
  <div v-else-if="error">
    <p>{{ error }}</p>
    <button type="button" @click="loadDetail">Retry</button>
  </div>
  <SoCTemplateDetail
    v-else-if="template"
    :template="template"
    :selected-core-id="selectedCoreId"
    @back="router.push('/soc')"
    @select-core="selectedCoreId = $event"
  />
</template>
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
pnpm --filter @ecos-studio/renderer exec vitest run \
  src/components/SoCTemplateInspector.test.ts \
  src/components/SoCTemplateDetail.test.ts \
  src/views/SoCTemplateDetailView.test.ts
```

Expected: PASS with 3 passing test files.

- [ ] **Step 5: Commit**

```bash
git add \
  ecos/gui/apps/renderer/src/components/SoCTemplateInspector.vue \
  ecos/gui/apps/renderer/src/components/SoCTemplateInspector.test.ts \
  ecos/gui/apps/renderer/src/components/SoCTemplateDetail.vue \
  ecos/gui/apps/renderer/src/components/SoCTemplateDetail.test.ts \
  ecos/gui/apps/renderer/src/views/SoCTemplateDetailView.vue \
  ecos/gui/apps/renderer/src/views/SoCTemplateDetailView.test.ts
git commit -m "feat(renderer): add soc template detail screen"
```

## Final Verification Commands

After Task 6, run the full renderer verification set before opening a PR or merging:

```bash
pnpm --filter @ecos-studio/renderer exec vitest run
pnpm --filter @ecos-studio/renderer exec vue-tsc --noEmit
```

Expected:

- `vitest run`: PASS
- `vue-tsc --noEmit`: PASS
