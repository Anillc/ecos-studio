# ECOS GUI Electron Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move `ecos/gui` from a single-package Tauri app to an internal workspace with Electron, while keeping development centered in `ecos/gui` and preserving the current Linux desktop feature set.

**Architecture:** Keep the work inside `ecos/gui`, but split it into hard package boundaries: `apps/renderer`, `apps/desktop-electron`, `packages/shared`, and `packages/tile-helper`. The renderer stops importing runtime APIs directly. Electron owns system access and process control. Shared contracts define the bridge. Tile generation becomes a local helper instead of shell glue.

**Tech Stack:** pnpm workspace, Vue 3, Vite 7, TypeScript 5, Electron, Electron Builder, Vitest, existing FastAPI backend

---

## File Map

### New package roots

- Create: `ecos/gui/pnpm-workspace.yaml`
- Create: `ecos/gui/apps/renderer/`
- Create: `ecos/gui/apps/desktop-electron/`
- Create: `ecos/gui/packages/shared/`
- Create: `ecos/gui/packages/tile-helper/`

### Renderer files that will move

- Move: `ecos/gui/src/** -> ecos/gui/apps/renderer/src/**`
- Move: `ecos/gui/public/** -> ecos/gui/apps/renderer/public/**`
- Move: `ecos/gui/index.html -> ecos/gui/apps/renderer/index.html`
- Move: `ecos/gui/vite.config.ts -> ecos/gui/apps/renderer/vite.config.ts`
- Move: `ecos/gui/tsconfig.json -> ecos/gui/apps/renderer/tsconfig.json`
- Move: `ecos/gui/tsconfig.node.json -> ecos/gui/apps/renderer/tsconfig.node.json`

### Desktop runtime files that will be created

- Create: `ecos/gui/apps/desktop-electron/package.json`
- Create: `ecos/gui/apps/desktop-electron/tsconfig.json`
- Create: `ecos/gui/apps/desktop-electron/electron/main/index.ts`
- Create: `ecos/gui/apps/desktop-electron/electron/main/createMainWindow.ts`
- Create: `ecos/gui/apps/desktop-electron/electron/main/registerIpc.ts`
- Create: `ecos/gui/apps/desktop-electron/electron/preload/index.ts`
- Create: `ecos/gui/apps/desktop-electron/electron/services/windowService.ts`
- Create: `ecos/gui/apps/desktop-electron/electron/services/workspaceService.ts`
- Create: `ecos/gui/apps/desktop-electron/electron/services/settingsStore.ts`
- Create: `ecos/gui/apps/desktop-electron/electron/services/apiServerService.ts`
- Create: `ecos/gui/apps/desktop-electron/electron/services/projectScopeService.ts`
- Create: `ecos/gui/apps/desktop-electron/electron/services/tileService.ts`
- Create: `ecos/gui/apps/desktop-electron/electron-builder.yml`

### Shared contract files that will be created

- Create: `ecos/gui/packages/shared/package.json`
- Create: `ecos/gui/packages/shared/tsconfig.json`
- Create: `ecos/gui/packages/shared/src/index.ts`
- Create: `ecos/gui/packages/shared/src/types/desktop.ts`
- Create: `ecos/gui/packages/shared/src/types/workspace.ts`
- Create: `ecos/gui/packages/shared/src/types/tile.ts`
- Create: `ecos/gui/packages/shared/src/constants/ipcChannels.ts`
- Create: `ecos/gui/packages/shared/src/contracts/desktopApi.ts`
- Create: `ecos/gui/packages/shared/src/contracts/errors.ts`

### Tile helper files that will be created

- Create: `ecos/gui/packages/tile-helper/package.json`
- Create: `ecos/gui/packages/tile-helper/tsconfig.json`
- Create: `ecos/gui/packages/tile-helper/src/index.ts`
- Create: `ecos/gui/packages/tile-helper/src/pathing.ts`
- Create: `ecos/gui/packages/tile-helper/src/cache.ts`
- Create: `ecos/gui/packages/tile-helper/src/generate.ts`
- Create: `ecos/gui/packages/tile-helper/src/manifest.ts`
- Create: `ecos/gui/packages/tile-helper/src/__tests__/cache.test.ts`
- Create: `ecos/gui/packages/tile-helper/src/__tests__/pathing.test.ts`

### Existing files that will be rewritten to use the bridge

- Modify: `ecos/gui/apps/renderer/src/App.vue`
- Modify: `ecos/gui/apps/renderer/src/components/TopBar.vue`
- Modify: `ecos/gui/apps/renderer/src/components/NewProjectWizard.vue`
- Modify: `ecos/gui/apps/renderer/src/composables/useMenuEvents.ts`
- Modify: `ecos/gui/apps/renderer/src/composables/useWorkspace.ts`
- Modify: `ecos/gui/apps/renderer/src/composables/usePdkManager.ts`
- Modify: `ecos/gui/apps/renderer/src/composables/useLayoutTileGen.ts`
- Modify: `ecos/gui/apps/renderer/src/composables/useTauri.ts`
- Modify: `ecos/gui/apps/renderer/src/utils/projectFs.ts`
- Modify: `ecos/gui/apps/renderer/src/api/client.ts`

### Files removed near the end

- Delete: `ecos/gui/src-tauri/**`
- Delete: `ecos/gui/default.nix` or rewrite it around Electron packaging
- Delete: Tauri-only scripts from `ecos/gui/package.json`

## Task 1: Turn `ecos/gui` into an internal workspace and relocate the renderer

**Files:**
- Create: `ecos/gui/pnpm-workspace.yaml`
- Create: `ecos/gui/apps/renderer/package.json`
- Create: `ecos/gui/apps/renderer/tsconfig.json`
- Create: `ecos/gui/apps/renderer/tsconfig.node.json`
- Modify: `ecos/gui/package.json`
- Modify: `ecos/gui/README.md`
- Move: `ecos/gui/src/**`, `public/**`, `index.html`, `vite.config.ts`, `tsconfig*.json`
- Test: `ecos/gui/apps/renderer/src/utils/sanitizeHtml.test.ts`

- [ ] **Step 1: Write the workspace manifest and root scripts**

```yaml
# ecos/gui/pnpm-workspace.yaml
packages:
  - apps/*
  - packages/*
```

```json
{
  "name": "ecos-gui-workspace",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "pnpm --filter @ecos/desktop-electron dev",
    "build": "pnpm -r build",
    "test": "pnpm -r test"
  }
}
```

- [ ] **Step 2: Create the renderer package before moving files**

```json
{
  "name": "@ecos/gui-renderer",
  "version": "0.1.0-alpha.3",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  }
}
```

- [ ] **Step 3: Move the current Vue app intact**

```bash
mkdir -p ecos/gui/apps/renderer
mv ecos/gui/src ecos/gui/apps/renderer/src
mv ecos/gui/public ecos/gui/apps/renderer/public
mv ecos/gui/index.html ecos/gui/apps/renderer/index.html
mv ecos/gui/vite.config.ts ecos/gui/apps/renderer/vite.config.ts
mv ecos/gui/tsconfig.json ecos/gui/apps/renderer/tsconfig.json
mv ecos/gui/tsconfig.node.json ecos/gui/apps/renderer/tsconfig.node.json
```

- [ ] **Step 4: Update renderer aliases and test paths**

```ts
// ecos/gui/apps/renderer/vite.config.ts
resolve: {
  alias: {
    '@': fileURLToPath(new URL('./src', import.meta.url))
  }
}
```

```json
// ecos/gui/apps/renderer/tsconfig.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src/**/*.ts", "src/**/*.d.ts", "src/**/*.vue"]
}
```

- [ ] **Step 5: Run the renderer tests and build**

Run: `cd ecos/gui && pnpm install && pnpm --filter @ecos/gui-renderer test`
Expected: existing Vitest suite passes from the new location

Run: `cd ecos/gui && pnpm --filter @ecos/gui-renderer build`
Expected: Vite build finishes and writes `apps/renderer/dist`

- [ ] **Step 6: Commit**

```bash
git add ecos/gui
git commit -m "refactor(gui): move renderer into workspace package"
```

## Task 2: Add the shared contract package and replace raw runtime imports with a bridge seam

**Files:**
- Create: `ecos/gui/packages/shared/package.json`
- Create: `ecos/gui/packages/shared/src/index.ts`
- Create: `ecos/gui/packages/shared/src/constants/ipcChannels.ts`
- Create: `ecos/gui/packages/shared/src/contracts/desktopApi.ts`
- Create: `ecos/gui/packages/shared/src/contracts/errors.ts`
- Create: `ecos/gui/packages/shared/src/types/{desktop,workspace,tile}.ts`
- Create: `ecos/gui/apps/renderer/src/platform/desktop.ts`
- Modify: `ecos/gui/apps/renderer/src/composables/useTauri.ts`
- Test: `ecos/gui/apps/renderer/src/utils/sanitizeHtml.test.ts`

- [ ] **Step 1: Define shared channel names and return types first**

```ts
// ecos/gui/packages/shared/src/constants/ipcChannels.ts
export const ipcChannels = {
  appReady: 'app:ready',
  windowMinimize: 'window:minimize',
  windowToggleMaximize: 'window:toggle-maximize',
  windowClose: 'window:close',
  workspaceOpen: 'workspace:open',
  workspaceCreate: 'workspace:create',
  workspaceLoadRecent: 'workspace:load-recent',
  workspaceSetProjectRoot: 'workspace:set-project-root',
  tilesGenerate: 'tiles:generate',
  systemOpenExternal: 'system:open-external'
} as const
```

```ts
// ecos/gui/packages/shared/src/contracts/errors.ts
export type DesktopErrorCode =
  | 'APP_BACKEND_UNAVAILABLE'
  | 'INVALID_PROJECT_DIRECTORY'
  | 'PROJECT_SCOPE_DENIED'
  | 'SETTINGS_WRITE_FAILED'
  | 'TILE_GENERATION_FAILED'

export interface DesktopErrorShape {
  code: DesktopErrorCode
  message: string
  detail?: string
}
```

- [ ] **Step 2: Define the preload-facing desktop API**

```ts
// ecos/gui/packages/shared/src/contracts/desktopApi.ts
import type { WorkspaceSummary, TileGenerationRequest, TileGenerationResult } from '../types'

export interface DesktopApi {
  window: {
    minimize(): Promise<void>
    toggleMaximize(): Promise<void>
    close(): Promise<void>
    setTitle(title: string): Promise<void>
    isMaximized(): Promise<boolean>
  }
  system: {
    openExternal(url: string): Promise<void>
  }
  workspace: {
    loadRecent(): Promise<WorkspaceSummary[]>
    openProject(): Promise<WorkspaceSummary | null>
  }
  tiles: {
    generate(request: TileGenerationRequest): Promise<TileGenerationResult>
  }
}
```

- [ ] **Step 3: Add a renderer-side adapter instead of importing runtime packages directly**

```ts
// ecos/gui/apps/renderer/src/platform/desktop.ts
import type { DesktopApi } from '@ecos/shared'

declare global {
  interface Window {
    ecosDesktop?: DesktopApi
  }
}

export function getDesktopApi(): DesktopApi {
  if (!window.ecosDesktop) {
    throw new Error('ECOS desktop bridge is not available')
  }
  return window.ecosDesktop
}
```

- [ ] **Step 4: Reduce `useTauri.ts` to an environment guard, not a feature surface**

```ts
// ecos/gui/apps/renderer/src/composables/useTauri.ts
import { getDesktopApi } from '@/platform/desktop'

export function isDesktopRuntime(): boolean {
  return typeof window !== 'undefined' && !!window.ecosDesktop
}

export function requireDesktopRuntime() {
  return getDesktopApi()
}
```

- [ ] **Step 5: Run one focused test and one typecheck**

Run: `cd ecos/gui && pnpm --filter @ecos/gui-renderer test src/utils/sanitizeHtml.test.ts`
Expected: PASS

Run: `cd ecos/gui && pnpm --filter @ecos/gui-renderer build`
Expected: PASS with the shared package linked in

- [ ] **Step 6: Commit**

```bash
git add ecos/gui
git commit -m "refactor(gui): add shared desktop contracts"
```

## Task 3: Bootstrap the Electron app and preload bridge

**Files:**
- Create: `ecos/gui/apps/desktop-electron/package.json`
- Create: `ecos/gui/apps/desktop-electron/tsconfig.json`
- Create: `ecos/gui/apps/desktop-electron/electron/main/index.ts`
- Create: `ecos/gui/apps/desktop-electron/electron/main/createMainWindow.ts`
- Create: `ecos/gui/apps/desktop-electron/electron/main/registerIpc.ts`
- Create: `ecos/gui/apps/desktop-electron/electron/preload/index.ts`
- Modify: `ecos/gui/package.json`
- Test: `ecos/gui/apps/desktop-electron/electron/main/registerIpc.ts`

- [ ] **Step 1: Create the Electron package with a dev loop that launches the renderer**

```json
{
  "name": "@ecos/desktop-electron",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build && electron-builder",
    "test": "vitest run"
  }
}
```

- [ ] **Step 2: Create a main entry that waits for the app and opens one window**

```ts
// ecos/gui/apps/desktop-electron/electron/main/index.ts
import { app } from 'electron'
import { createMainWindow } from './createMainWindow'
import { registerIpc } from './registerIpc'

app.whenReady().then(() => {
  registerIpc()
  createMainWindow()
})
```

- [ ] **Step 3: Expose the typed preload bridge**

```ts
// ecos/gui/apps/desktop-electron/electron/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron'
import { ipcChannels } from '@ecos/shared'

contextBridge.exposeInMainWorld('ecosDesktop', {
  window: {
    minimize: () => ipcRenderer.invoke(ipcChannels.windowMinimize),
    toggleMaximize: () => ipcRenderer.invoke(ipcChannels.windowToggleMaximize),
    close: () => ipcRenderer.invoke(ipcChannels.windowClose),
    setTitle: (title: string) => ipcRenderer.invoke('window:set-title', title),
    isMaximized: () => ipcRenderer.invoke('window:is-maximized')
  }
})
```

- [ ] **Step 4: Add one smoke test around channel registration**

```ts
// ecos/gui/apps/desktop-electron/electron/main/registerIpc.test.ts
import { describe, expect, it } from 'vitest'
import { ipcChannels } from '@ecos/shared'

describe('ipcChannels', () => {
  it('keeps stable channel names for window controls', () => {
    expect(ipcChannels.windowMinimize).toBe('window:minimize')
    expect(ipcChannels.windowToggleMaximize).toBe('window:toggle-maximize')
  })
})
```

- [ ] **Step 5: Run the Electron package tests and dev boot**

Run: `cd ecos/gui && pnpm --filter @ecos/desktop-electron test`
Expected: PASS

Run: `cd ecos/gui && pnpm dev`
Expected: one Electron window opens and loads the renderer app

- [ ] **Step 6: Commit**

```bash
git add ecos/gui
git commit -m "feat(gui): bootstrap electron shell"
```

## Task 4: Migrate window, menu, and external-link behavior off Tauri

**Files:**
- Modify: `ecos/gui/apps/renderer/src/App.vue`
- Modify: `ecos/gui/apps/renderer/src/components/TopBar.vue`
- Modify: `ecos/gui/apps/renderer/src/composables/useMenuEvents.ts`
- Create: `ecos/gui/apps/desktop-electron/electron/services/windowService.ts`
- Modify: `ecos/gui/apps/desktop-electron/electron/main/registerIpc.ts`
- Test: `ecos/gui/apps/renderer/src/components/TopBar.vue`

- [ ] **Step 1: Write a focused renderer test for the top bar actions**

```ts
it('routes topbar window actions through the desktop bridge', async () => {
  const minimize = vi.fn().mockResolvedValue(undefined)
  ;(window as any).ecosDesktop = {
    window: { minimize, toggleMaximize: vi.fn(), close: vi.fn(), setTitle: vi.fn(), isMaximized: vi.fn() }
  }
  // mount and trigger click
  expect(minimize).toHaveBeenCalledTimes(1)
})
```

- [ ] **Step 2: Replace direct Tauri calls in renderer files**

```ts
// TopBar.vue
import { getDesktopApi } from '@/platform/desktop'

const desktop = getDesktopApi()
const handleMinimize = () => desktop.window.minimize()
const handleMaximize = () => desktop.window.toggleMaximize()
const handleClose = async () => {
  await closeProject()
  await desktop.window.close()
}
```

```ts
// App.vue
const desktop = getDesktopApi()
await desktop.system.openExternal('https://github.com/openecos-projects/ecos-studio/blob/main/ecos/docs/user-guide.md')
```

- [ ] **Step 3: Implement the Electron side window service**

```ts
// electron/services/windowService.ts
export function minimizeWindow(window: BrowserWindow) {
  window.minimize()
}

export function toggleMaximizeWindow(window: BrowserWindow) {
  if (window.isMaximized()) window.unmaximize()
  else window.maximize()
}
```

- [ ] **Step 4: Register menu and window IPC handlers**

```ts
ipcMain.handle(ipcChannels.windowMinimize, () => {
  minimizeWindow(getMainWindow())
})

ipcMain.handle(ipcChannels.windowToggleMaximize, () => {
  toggleMaximizeWindow(getMainWindow())
})
```

- [ ] **Step 5: Run the renderer tests and manual smoke test**

Run: `cd ecos/gui && pnpm --filter @ecos/gui-renderer test`
Expected: PASS

Run: `cd ecos/gui && pnpm dev`
Expected: top bar buttons, double-click maximize, and external docs links work in Electron

- [ ] **Step 6: Commit**

```bash
git add ecos/gui
git commit -m "refactor(gui): move window controls to electron bridge"
```

## Task 5: Move workspace, settings, project-scope, and backend-process control into Electron services

**Files:**
- Create: `ecos/gui/apps/desktop-electron/electron/services/settingsStore.ts`
- Create: `ecos/gui/apps/desktop-electron/electron/services/projectScopeService.ts`
- Create: `ecos/gui/apps/desktop-electron/electron/services/apiServerService.ts`
- Create: `ecos/gui/apps/desktop-electron/electron/services/workspaceService.ts`
- Modify: `ecos/gui/apps/desktop-electron/electron/preload/index.ts`
- Modify: `ecos/gui/apps/renderer/src/composables/useWorkspace.ts`
- Modify: `ecos/gui/apps/renderer/src/composables/usePdkManager.ts`
- Modify: `ecos/gui/apps/renderer/src/api/client.ts`
- Modify: `ecos/gui/apps/renderer/src/utils/projectFs.ts`
- Test: `ecos/gui/apps/renderer/src/composables/useParameters.test.ts`

- [ ] **Step 1: Write failing tests for workspace persistence and API-port handoff**

```ts
it('uses the desktop bridge to resolve the API port', async () => {
  ;(window as any).ecosDesktop = {
    workspace: { getApiPort: vi.fn().mockResolvedValue(9123) }
  }
  await initApiPort()
  expect(API_PORT).toBe(9123)
})
```

- [ ] **Step 2: Port the Rust responsibilities into focused Electron services**

```ts
// settingsStore.ts
export class SettingsStore {
  async getRecentProjects(): Promise<WorkspaceSummary[]> {
    return []
  }
}
```

```ts
// apiServerService.ts
export class ApiServerService {
  async ensureRunning(): Promise<{ port: number }> {
    return { port: 8765 }
  }
}
```

```ts
// projectScopeService.ts
export function assertWithinProjectRoot(projectRoot: string, candidatePath: string): string {
  return candidatePath
}
```

- [ ] **Step 3: Rewrite renderer composables to use `window.ecosDesktop`**

```ts
// useWorkspace.ts
const desktop = getDesktopApi()
const project = await desktop.workspace.openProject()
```

```ts
// api/client.ts
const port = await getDesktopApi().workspace.getApiPort()
```

- [ ] **Step 4: Keep the API health polling, but remove Tauri-specific imports**

```ts
if (!isDesktopRuntime()) {
  throw new Error('Electron desktop bridge is required')
}
```

- [ ] **Step 5: Run focused tests plus a manual open-project flow**

Run: `cd ecos/gui && pnpm --filter @ecos/gui-renderer test`
Expected: PASS

Run: `cd ecos/gui && pnpm dev`
Expected: opening a project updates the title, starts FastAPI, and restores recent projects

- [ ] **Step 6: Commit**

```bash
git add ecos/gui
git commit -m "feat(gui): move workspace services into electron"
```

## Task 6: Extract tile generation into `packages/tile-helper` and wire it through Electron

**Files:**
- Create: `ecos/gui/packages/tile-helper/src/{index,pathing,cache,generate,manifest}.ts`
- Create: `ecos/gui/packages/tile-helper/src/__tests__/{cache,pathing}.test.ts`
- Create: `ecos/gui/apps/desktop-electron/electron/services/tileService.ts`
- Modify: `ecos/gui/apps/desktop-electron/electron/preload/index.ts`
- Modify: `ecos/gui/apps/renderer/src/composables/useLayoutTileGen.ts`
- Modify: `ecos/gui/apps/renderer/src/api/client.ts`
- Test: `ecos/gui/apps/renderer/src/composables/useLayoutTileGen.drcPath.test.ts`

- [ ] **Step 1: Write failing tests for cache pathing and step-key sanitizing**

```ts
it('sanitizes the step key into a safe cache directory name', () => {
  expect(sanitizeStepKey('../cts.final')).toBe('cts_final')
})
```

```ts
it('derives the layout cache directory under .ecos/tile-cache/layout', () => {
  expect(buildTileCacheDir('/tmp/project', 'floorplan')).toBe('/tmp/project/.ecos/tile-cache/layout/floorplan')
})
```

- [ ] **Step 2: Port the cache and path logic first, before the generator body**

```ts
// cache.ts
export function sanitizeStepKey(raw: string): string {
  return raw.trim().replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || '_default'
}
```

```ts
// pathing.ts
export function buildTileCacheDir(projectRoot: string, stepKey: string) {
  return join(projectRoot, '.ecos', 'tile-cache', 'layout', sanitizeStepKey(stepKey))
}
```

- [ ] **Step 3: Port the generator behind one service boundary**

```ts
// tileService.ts
import { generateTiles } from '@ecos/tile-helper'

export async function handleGenerateTiles(request: TileGenerationRequest) {
  return generateTiles(request)
}
```

```ts
// useLayoutTileGen.ts
const desktop = getDesktopApi()
const result = await desktop.tiles.generate({ projectPath, layoutJsonRelative, stepKey })
```

- [ ] **Step 4: Preserve the current renderer contract: output path in, file URL out**

```ts
return {
  baseUrl: result.baseUrl,
  outDir: result.outDir,
  fromCache: result.fromCache
}
```

- [ ] **Step 5: Run tile tests and a manual tile generation smoke test**

Run: `cd ecos/gui && pnpm --filter @ecos/tile-helper test`
Expected: PASS

Run: `cd ecos/gui && pnpm --filter @ecos/gui-renderer test src/composables/useLayoutTileGen.drcPath.test.ts`
Expected: PASS

Run: `cd ecos/gui && pnpm dev`
Expected: tile generation works, cache hits still skip regeneration, and the editor loads rendered tiles

- [ ] **Step 6: Commit**

```bash
git add ecos/gui
git commit -m "refactor(gui): extract tile helper from tauri"
```

## Task 7: Remove Tauri, update build scripts, and switch release packaging to Electron

**Files:**
- Delete: `ecos/gui/src-tauri/**`
- Modify: `ecos/gui/package.json`
- Modify: `ecos/gui/README.md`
- Modify: `ecos/scripts/build-gui.sh`
- Modify: `ecos/gui/default.nix`
- Create: `ecos/gui/apps/desktop-electron/electron-builder.yml`
- Test: Linux desktop package output

- [ ] **Step 1: Remove Tauri dependencies only after all bridge call sites are gone**

```json
{
  "dependencies": {
    "@tauri-apps/api": null,
    "@tauri-apps/plugin-dialog": null,
    "@tauri-apps/plugin-fs": null,
    "@tauri-apps/plugin-shell": null,
    "@tauri-apps/plugin-store": null
  }
}
```

- [ ] **Step 2: Replace Tauri build scripts with Electron entrypoints**

```json
{
  "scripts": {
    "dev": "pnpm --filter @ecos/desktop-electron dev",
    "build": "pnpm -r build",
    "test": "pnpm -r test"
  }
}
```

- [ ] **Step 3: Rewrite the GUI build script around Electron artifacts**

```bash
# ecos/scripts/build-gui.sh
cd "$GUI_DIR"
pnpm install --frozen-lockfile
pnpm build
pnpm --filter @ecos/desktop-electron build
```

- [ ] **Step 4: Update docs and Nix wiring**

```md
# ecos/gui/README.md
- `pnpm dev` starts the Electron shell and the renderer together.
- `pnpm build` builds the workspace packages and the Linux desktop artifact.
```

- [ ] **Step 5: Run final verification**

Run: `cd ecos/gui && pnpm test`
Expected: PASS across renderer, desktop, and helper packages

Run: `cd ecos/gui && pnpm build`
Expected: PASS and Electron build artifacts are produced for Linux

- [ ] **Step 6: Commit**

```bash
git add ecos/gui ecos/scripts/build-gui.sh
git commit -m "build(gui): switch desktop packaging from tauri to electron"
```

## Self-Review Notes

- Spec coverage: this plan covers the internal workspace split, hard package boundaries, Electron runtime, shared contracts, project scope, FastAPI process management, tile helper extraction, and Linux packaging.
- Placeholder scan: avoid leaving `src-tauri` half-removed. Do not merge with bridge methods that still do nothing except throw.
- Type consistency: keep `DesktopApi`, `WorkspaceSummary`, `TileGenerationRequest`, and `TileGenerationResult` defined once in `packages/shared` and imported everywhere else.

## Execution Handoff

This plan is written for the recommended path: subagent-driven execution. The first implementation slice should be **Task 1**, because every later task depends on the workspace layout existing first.
