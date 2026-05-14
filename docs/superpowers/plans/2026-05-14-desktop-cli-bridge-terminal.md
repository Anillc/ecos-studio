# ECOS Studio Terminal + Desktop CLI Bridge Plan

## Summary

Goal: add a VS Code style terminal to ECOS Studio and move GUI actions onto a desktop CLI bridge. The terminal should be a real shell backed by `node-pty`; it should not parse `ecos ...` commands inside the renderer. Users can run `ecos ...` directly in the shell.

The GUI path stays separate from the shell path:

```text
Renderer UI
  ├─ GUI buttons
  │     ↓
  │   Renderer API wrappers
  │     ↓
  │   window.ecosDesktop.cli
  │     ↓
  │   Preload desktop bridge
  │     ↓
  │   Electron main Desktop CLI Bridge
  │     ↓
  │   apiCliAdapter for v1
  │     ↓
  │   Current FastAPI workspace API
  │
  └─ ECOSTerminal (@xterm/xterm)
        ↓
      window.ecosDesktop.shell
        ↓
      Preload desktop bridge
        ↓
      Electron main Shell API
        ↓
      node-pty
        ↓
      User shell, where `ecos ...` can run normally
```

The v1 bridge still calls the current FastAPI server through `apiCliAdapter`. A later branch can replace that adapter with a real `ecos` CLI process adapter without changing renderer-facing APIs.

Do not expose raw Node, Python, filesystem, IPC, or `node-pty` objects to the renderer. The renderer only sees narrow desktop bridge namespaces:

```ts
window.ecosDesktop.cli
window.ecosDesktop.shell
```

## Scope

This branch includes:

- A global app-level terminal panel using xterm.js.
- A shell service in Electron main backed by `node-pty`.
- A Desktop CLI Bridge for GUI button execution.
- Renderer API wrappers that use `window.ecosDesktop.cli.execute` in desktop runtime and keep HTTP fallback for browser-only dev.
- Shared desktop contracts and IPC channels for `cli` and `shell`.
- Tests for bridge behavior, shell behavior, IPC forwarding, and terminal shell wiring.

This branch does not include:

- Renderer-owned shell commands or command parsing.
- A terminal mode toggle.
- Replacing `ecos/server` with a Python worker.
- Replacing the v1 FastAPI adapter with a real CLI process adapter.

## 1. Terminal UI

Add dependencies to `@ecos-studio/renderer`:

```bash
pnpm --filter @ecos-studio/renderer add @xterm/xterm @xterm/addon-fit @xterm/addon-web-links @xterm/addon-search
```

Create:

```text
ecos/gui/apps/renderer/src/components/ECOSTerminal.vue
```

Expected behavior:

- Render `@xterm/xterm` inside a bottom terminal panel.
- Use `FitAddon` so the terminal resizes with the panel/window.
- Use `WebLinksAddon` so links and paths in shell output are usable.
- Load `SearchAddon` for future terminal search UI.
- Start a real shell through `window.ecosDesktop.shell.createSession` when the terminal first expands.
- Forward all terminal input to `window.ecosDesktop.shell.write`.
- Forward terminal resize events to `window.ecosDesktop.shell.resize`.
- Render PTY output from `window.ecosDesktop.shell.onData`.
- Report shell exit events from `window.ecosDesktop.shell.onExit`.
- Kill the shell session when the terminal component unmounts.

The terminal should not call `window.ecosDesktop.cli.execute`. It is a shell surface, not a second GUI command runner.

## 2. Global Terminal Panel

Mount the terminal from `App.vue`, below routed content and above or alongside `StatusBar`.

Default behavior:

- Terminal is collapsed by default.
- A compact status bar control toggles the panel.
- The panel overlays the bottom of the app and leaves the status bar visible.
- The terminal survives route changes because it is mounted at app level.
- Existing full-screen layout states in `HomeView.vue` should keep working.

Suggested UI model:

```text
TopBar
Content
Terminal panel, collapsible overlay
StatusBar
```

Avoid placing the terminal inside `HomeView.vue`.

## 3. Shared CLI Contracts

Add CLI Bridge types in:

```text
ecos/gui/packages/shared/src/contracts/desktopCli.ts
```

Minimum v1 model:

```ts
export type DesktopCliCommandName =
  | 'help'
  | 'clear'
  | 'load_workspace'
  | 'create_workspace'
  | 'set_pdk_root'
  | 'run_step'
  | 'rtl2gds'
  | 'get_info'
  | 'home_page'

export type DesktopCliCommandSource = 'button' | 'terminal'

export type DesktopCliCommandResponse = 'success' | 'failed' | 'error' | 'warning'

export interface DesktopCliCommandRequest {
  cmd: DesktopCliCommandName
  data: Record<string, unknown>
  source: DesktopCliCommandSource
}

export interface DesktopCliCommandResult {
  ok: boolean
  cmd: DesktopCliCommandName
  response: DesktopCliCommandResponse
  data: Record<string, unknown>
  message: string[]
}

export interface DesktopCliCommandEvent {
  jobId: string
  type: 'started' | 'output' | 'completed' | 'failed'
  cmd: DesktopCliCommandName
  stream?: 'stdout' | 'stderr' | 'system'
  text?: string
  result?: DesktopCliCommandResult
}
```

Extend:

```text
ecos/gui/packages/shared/src/constants/ipcChannels.ts
ecos/gui/packages/shared/src/contracts/desktopApi.ts
ecos/gui/packages/shared/src/index.ts
```

Desktop API shape:

```ts
cli: {
  execute(request: DesktopCliCommandRequest): Promise<DesktopCliCommandResult>
  onEvent(listener: (event: DesktopCliCommandEvent) => void): DesktopEventUnsubscribe
}
```

## 4. Desktop CLI Bridge

Create:

```text
ecos/gui/apps/desktop-electron/electron/services/desktopCliBridgeService.ts
```

Responsibilities:

- Validate supported CLI command names.
- Generate a `jobId` for lifecycle events.
- Prevent overlapping long-running ECC commands in v1.
- Emit lifecycle events to the originating renderer.
- Route requests through a replaceable adapter.
- Return a normalized `DesktopCliCommandResult`.

For v1, route GUI requests to the existing FastAPI server:

```text
desktopCliBridgeService
  -> apiCliAdapter
  -> http://127.0.0.1:<apiPort>/api/workspace/*
```

Create:

```text
ecos/gui/apps/desktop-electron/electron/services/apiCliAdapter.ts
```

Mapping:

```text
load_workspace   -> POST /api/workspace/load_workspace
create_workspace -> POST /api/workspace/create_workspace
set_pdk_root     -> POST /api/workspace/set_pdk_root
run_step         -> POST /api/workspace/run_step
rtl2gds          -> POST /api/workspace/rtl2gds
get_info         -> POST /api/workspace/get_info
home_page        -> POST /api/workspace/get_home_page
```

Keep `ApiServerService` for v1. Do not remove `ecos/server` in this branch.

Future adapter:

```text
desktopCliBridgeService
  -> ecosCliAdapter
  -> child_process.spawn("ecos", ...)
```

That swap should not require renderer changes.

## 5. Preload and IPC

Modify:

```text
ecos/gui/apps/desktop-electron/electron/main/registerIpc.ts
ecos/gui/apps/desktop-electron/electron/preload/index.ts
ecos/gui/apps/desktop-electron/electron/main/index.ts
```

Add the CLI Bridge service to `DesktopBridgeServices`.

IPC channels:

```ts
cliExecute: 'cli:execute'
```

Event channel:

```ts
cliEvent: 'cli:event'
```

Preload exposes:

```ts
window.ecosDesktop.cli.execute(...)
window.ecosDesktop.cli.onEvent(...)
```

Preload must not expose raw `ipcRenderer`.

## 6. Shell API

Add `node-pty` to desktop Electron only:

```bash
pnpm --filter @ecos-studio/desktop-electron add node-pty
```

Add shared shell contracts in:

```text
ecos/gui/packages/shared/src/contracts/desktopShell.ts
```

Desktop API shape:

```ts
shell: {
  createSession(options): Promise<ShellSession>
  write(sessionId, data): Promise<void>
  resize(sessionId, cols, rows): Promise<void>
  kill(sessionId): Promise<void>
  onData(listener): DesktopEventUnsubscribe
  onExit(listener): DesktopEventUnsubscribe
}
```

Create:

```text
ecos/gui/apps/desktop-electron/electron/services/shellPtyService.ts
```

Responsibilities:

- Choose the user's shell from `SHELL` or `COMSPEC`.
- Create one PTY session per renderer request.
- Send data and exit events only to the renderer that owns the session.
- Forward writes and resizes to the active PTY.
- Kill sessions explicitly and when the owning renderer is destroyed.

Keep `shell` separate from `cli`. Terminal input goes to `shell`; GUI button execution goes to `cli`.

## 7. Renderer API Migration

Migrate existing renderer API wrappers to use the Desktop CLI Bridge when available.

Targets:

```text
ecos/gui/apps/renderer/src/api/flow.ts
ecos/gui/apps/renderer/src/api/workspace.ts
```

Behavior:

- In desktop runtime, use `window.ecosDesktop.cli.execute`.
- In browser-only dev fallback, keep the current HTTP client.
- Keep exported function names such as `runStepApi`, `rtl2gdsApi`, `loadWorkspaceApi`, and `createWorkspaceApi`.

This keeps existing composables stable while moving GUI execution to the desktop bridge.

## 8. Avoid Renderer-Owned Shell Commands

The terminal should not implement `help`, `clear`, command history, or `ecos ...` parsing itself. Those belong to the user's real shell and the actual `ecos` CLI.

## 9. Later Work

Do not implement these in this branch:

- Replace FastAPI with a Python ECC worker.
- Replace `apiCliAdapter` with a real `ecosCliAdapter`.
- Replace SSE workspace updates with CLI Bridge events.
- Add a terminal search UI around `SearchAddon`.

Future Python worker shape, if needed:

```text
desktopCliBridgeService
  -> pythonEccWorkerService
  -> child_process.spawn(python worker)
  -> JSON lines protocol over stdin/stdout
  -> chipcompiler APIs
```

The renderer should still talk to `window.ecosDesktop.cli`.

## Test Plan

### Unit Tests

Add or update:

```text
ecos/gui/apps/desktop-electron/electron/services/desktopCliBridgeService.test.ts
ecos/gui/apps/desktop-electron/electron/services/apiCliAdapter.test.ts
ecos/gui/apps/desktop-electron/electron/services/shellPtyService.test.ts
```

Cover:

- `run_step` maps to the current FastAPI endpoint shape.
- Successful API responses normalize to `DesktopCliCommandResult`.
- Failed, HTTP, and network errors normalize cleanly.
- Unknown CLI command names are rejected.
- Overlapping long-running ECC commands are blocked in v1.
- Started, completed, and failed lifecycle events are emitted.
- Shell service chooses the user's shell.
- Shell service forwards PTY data and exit events.
- Shell service delegates write, resize, and kill to active PTY sessions.
- Shell service rejects writes, resizes, or kills for unknown sessions.

### IPC Tests

Extend:

```text
ecos/gui/apps/desktop-electron/electron/main/registerIpc.test.ts
```

Cover:

- `cli:execute` calls the CLI Bridge service.
- CLI events are sent to the requesting renderer.
- Destroyed renderers do not receive CLI events.
- `shell:create-session` creates a PTY session through the shell service.
- Shell data and exit events are sent to the requesting renderer.
- Destroyed renderers do not receive shell events.
- Shell sessions are killed when the originating renderer is destroyed.

### Component Tests

Add or update:

```text
ecos/gui/apps/renderer/src/components/ECOSTerminal.test.ts
```

Cover:

- Terminal loads xterm, fit, web links, and search addons.
- Terminal starts a shell session through `window.ecosDesktop.shell`.
- Terminal forwards input directly to the active shell session.
- Terminal forwards resize events to the shell session.
- Terminal does not import or call renderer ECOS command parser code.
- Terminal does not call `window.ecosDesktop.cli.execute`.
- Terminal overlays app content without breaking the status bar.

Mock xterm.js in tests. Do not rely on canvas or DOM internals.

### Existing Checks

Run after implementation:

```bash
pnpm --filter @ecos-studio/renderer run typecheck
pnpm --filter @ecos-studio/renderer run test
pnpm --filter @ecos-studio/desktop-electron run typecheck
pnpm --filter @ecos-studio/desktop-electron run test
pnpm --filter @ecos-studio/desktop-electron run build
pnpm -r --if-present run typecheck
pnpm -r --if-present run test
```

### Manual Acceptance

Verify in the Electron dev app:

- Terminal opens and closes from the bottom panel.
- Expanding the terminal starts a real shell through `node-pty`.
- Shell output appears in the terminal.
- Terminal input is forwarded to the shell.
- Running `ecos ...` in the terminal goes through the user's shell.
- Typing `exit` reports the shell exit code.
- Window resize keeps the terminal fitted.
- Route changes do not destroy the terminal component.
- GUI buttons still work.
- GUI buttons call `window.ecosDesktop.cli.execute` in desktop runtime.
- Browser-only renderer fallback still uses HTTP.
- Renderer code never receives raw `node-pty`, raw IPC, filesystem, or Python access.
