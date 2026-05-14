# ECOS Studio Terminal + Command Bus Implementation Plan

## Summary

Goal: add a VS Code style terminal experience to ECOS Studio, while making GUI buttons and terminal `ecos ...` commands share the same execution path.

Current architecture target:

```text
Renderer UI
  ├─ GUI buttons
  └─ ECOSTerminal (@xterm/xterm)
        ├─ ECOS command mode
        │     ↓
        │   Preload desktop bridge
        │     ↓
        │   Electron main Command Bus
        │     ↓
        │   Current FastAPI adapter
        └─ Shell mode
              ↓
            Preload desktop bridge
              ↓
            Electron main Shell API
              ↓
            node-pty
```

The first pass implemented v1 and then jumped to v3. v2 is still useful, but it is no longer the next step for this branch.

- v1: integrate terminal UI and command bus, but keep current `ecos/server` behind an adapter.
- v2: later, replace FastAPI with a Python ECC worker without changing renderer-facing APIs.
- v3: add `node-pty` for full shell mode, kept separate from ECOS command execution.

Implementation must start by using `$using-superpowers` and use `$humanizer` for user-facing docs, help text, PR notes, and final explanations.

## Key changes

### 1. Add a terminal UI with xterm.js

Add dependencies to `@ecos-studio/renderer`:

```bash
pnpm --filter @ecos-studio/renderer add @xterm/xterm @xterm/addon-fit @xterm/addon-web-links @xterm/addon-search
```

Create a focused terminal component:

```text
ecos/gui/apps/renderer/src/components/ECOSTerminal.vue
```

Expected behavior:

- Render `@xterm/xterm` inside a bottom panel.
- Use `FitAddon` so the terminal resizes with the panel/window.
- Use `WebLinksAddon` so paths/URLs in output are usable.
- Use `SearchAddon` for later terminal search UI.
- Start in ECOS command mode, not full shell mode.
- Show a prompt like:

```text
ecos>
```

- Support:
  - typing
  - Enter
  - Backspace
  - arrow-up / arrow-down command history
  - Ctrl+L / `clear`
  - `help`
  - command echo
  - readable error output

Do not expose raw Node, Python, filesystem, IPC, or `node-pty` objects to the renderer. ECOS command mode only calls `window.ecosDesktop.commands`; shell mode only calls the narrow `window.ecosDesktop.shell` bridge.

### 2. Add a global terminal panel

Mount the terminal from `App.vue`, below the routed content and above or alongside `StatusBar`.

Default behavior:

- Terminal is collapsed by default.
- Add a small toggle button in the status bar area or a compact bottom-tab header.
- When expanded, it takes a fixed/resizable bottom height, similar to VS Code.
- It must not break existing full-screen layout states in `HomeView.vue`.
- It must survive route changes.

Suggested UI model:

```text
TopBar
Content
Terminal panel, collapsible
StatusBar
```

Avoid placing the first version inside `HomeView.vue`; the terminal should be app-level.

### 3. Define shared command contracts

Add command bus types to shared contracts, for example in:

```text
ecos/gui/packages/shared/src/contracts/desktopCommands.ts
```

Minimum v1 command model:

```ts
export type DesktopCommandName =
  | 'help'
  | 'clear'
  | 'load_workspace'
  | 'create_workspace'
  | 'run_step'
  | 'rtl2gds'
  | 'get_info'
  | 'home_page'

export interface DesktopCommandRequest {
  cmd: DesktopCommandName
  data: Record<string, unknown>
  source: 'button' | 'terminal'
}

export interface DesktopCommandResult {
  ok: boolean
  cmd: DesktopCommandName
  response: 'success' | 'failed' | 'error' | 'warning'
  data: Record<string, unknown>
  message: string[]
}
```

Add events for command output and lifecycle:

```ts
export interface DesktopCommandEvent {
  jobId: string
  type: 'started' | 'output' | 'completed' | 'failed'
  cmd: DesktopCommandName
  stream?: 'stdout' | 'stderr' | 'system'
  text?: string
  result?: DesktopCommandResult
}
```

Extend:

```text
ecos/gui/packages/shared/src/constants/ipcChannels.ts
ecos/gui/packages/shared/src/contracts/desktopApi.ts
```

Add desktop API shape:

```ts
commands: {
  execute(request: DesktopCommandRequest): Promise<DesktopCommandResult>
  onEvent(listener: (event: DesktopCommandEvent) => void): DesktopEventUnsubscribe
}
```

### 4. Implement Electron main Command Bus

Create a service:

```text
ecos/gui/apps/desktop-electron/electron/services/commandBusService.ts
```

Responsibilities:

- Validate command names.
- Generate `jobId`.
- Prevent overlapping long-running ECC commands in v1.
- Emit command lifecycle events to renderer windows.
- Route commands through an adapter.
- Return normalized `DesktopCommandResult`.

For v1, route ECC commands to the existing FastAPI server through a local adapter:

```text
commandBusService
  -> apiCommandAdapter
  -> http://127.0.0.1:<apiPort>/api/workspace/*
```

This lets the UI and terminal move to the new command API before removing `ecos/server`.

Create adapter:

```text
ecos/gui/apps/desktop-electron/electron/services/apiCommandAdapter.ts
```

Mapping:

```text
load_workspace   -> POST /api/workspace/load_workspace
create_workspace -> POST /api/workspace/create_workspace
set_pdk_root     -> POST /api/workspace/set_pdk_root, optional later
run_step         -> POST /api/workspace/run_step
rtl2gds          -> POST /api/workspace/rtl2gds
get_info         -> POST /api/workspace/get_info
home_page        -> POST /api/workspace/get_home_page
```

Keep `ApiServerService` for v1. Do not remove `ecos/server` yet.

### 5. Expose Command Bus through preload

Modify:

```text
ecos/gui/apps/desktop-electron/electron/main/registerIpc.ts
ecos/gui/apps/desktop-electron/electron/preload/index.ts
ecos/gui/apps/desktop-electron/electron/main/index.ts
```

Add command service to `DesktopBridgeServices`.

Add IPC channels:

```ts
commandsExecute: 'commands:execute'
```

Add event channel:

```ts
commandEvent: 'commands:event'
```

Preload must expose only:

```ts
window.ecosDesktop.commands.execute(...)
window.ecosDesktop.commands.onEvent(...)
```

Do not expose raw `ipcRenderer`.

### 6. Add terminal command parser in renderer

Create:

```text
ecos/gui/apps/renderer/src/terminal/parseEcosCommand.ts
ecos/gui/apps/renderer/src/terminal/formatTerminalOutput.ts
```

Supported v1 syntax:

```text
help
clear
ecos help
ecos run-all
ecos run-step <step>
ecos get-info <step> <id>
ecos home-page
ecos load-workspace <absolute-path>
```

Parsing rules:

- `run-all` maps to `rtl2gds`.
- `run-step place` maps to `{ cmd: 'run_step', data: { step: 'place', rerun: false } }`.
- `get-info place layout` maps to `{ cmd: 'get_info', data: { step: 'place', id: 'layout' } }`.
- Unknown commands print help and do not call Electron.
- Empty input just prints a new prompt.

Do not implement shell commands like `ls`, `pwd`, `git`, or `nix` in v1.

### 7. Gradually migrate GUI buttons to Command Bus

After terminal UI and Command Bus are working, migrate the existing renderer API wrappers to call the desktop command API when available.

Targets:

```text
ecos/gui/apps/renderer/src/api/flow.ts
ecos/gui/apps/renderer/src/api/workspace.ts
```

Behavior:

- In desktop runtime, use `window.ecosDesktop.commands.execute`.
- In browser-only dev fallback, keep current HTTP client.
- Keep existing exported function names like `runStepApi`, `rtl2gdsApi`, `loadWorkspaceApi`, `createWorkspaceApi` so composables do not all change at once.

This keeps existing UI behavior while moving execution to the same path used by terminal commands.

### 8. Keep SSE for v1, plan IPC events for v2

For v1:

- Keep current SSE client and server notifications.
- Command Bus emits basic lifecycle events for terminal display.
- Existing workspace refresh logic can keep using `createSSEClient`.

For v2:

- Replace SSE with `commands.onEvent` and workspace file watchers.
- Move `ECCService`-like behavior into a Python worker.
- The renderer should not need API changes because it already talks to Command Bus.

### 9. Future Python worker replacement for `ecos/server`

Do not implement this in the first terminal integration unless explicitly requested.

Future structure:

```text
Electron commandBusService
  -> pythonEccWorkerService
  -> child_process.spawn(python worker)
  -> JSON lines protocol over stdin/stdout
  -> chipcompiler APIs
```

Worker commands mirror the shared `DesktopCommandRequest` / `DesktopCommandResult`.

Future worker file can live under a new package or under `ecos/gui/apps/desktop-electron/resources/ecc-worker/`, but the better long-term move is to extract reusable non-FastAPI ECC command logic from `ecos/server/ecos_server/ecc/services/ecc.py` into a package-level module that both server and worker can call during migration.

### 10. v3 full shell mode with node-pty

Add `node-pty` to desktop Electron only:

```bash
pnpm --filter @ecos-studio/desktop-electron add node-pty
```

Add a separate API namespace:

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

Keep this separate from `commands`. ECOS commands should continue to use Command Bus so GUI state stays synchronized.

Renderer behavior:

- The terminal starts in ECOS command mode.
- A compact ECOS/Shell toggle switches modes.
- Entering shell mode creates a `node-pty` session in Electron main.
- Shell input is forwarded to the active PTY session.
- PTY output and exit events are sent back only to the renderer that created the session.
- Resizing the terminal forwards xterm rows/columns to the PTY.
- Switching back to ECOS mode or destroying the renderer kills the session.

## Test plan

### Unit tests

Add tests for parser behavior:

```text
ecos/gui/apps/renderer/src/terminal/parseEcosCommand.test.ts
```

Cover:

- `help`
- `clear`
- `ecos run-all`
- `ecos run-step place`
- `ecos get-info place layout`
- unknown command
- empty input

Add tests for Electron command service:

```text
ecos/gui/apps/desktop-electron/electron/services/commandBusService.test.ts
ecos/gui/apps/desktop-electron/electron/services/apiCommandAdapter.test.ts
```

Cover:

- maps `run_step` to the current API endpoint shape
- returns normalized success result
- returns normalized error result
- rejects unknown commands
- blocks overlapping long-running commands in v1
- emits started/completed/failed events

Extend existing IPC tests:

```text
ecos/gui/apps/desktop-electron/electron/main/registerIpc.test.ts
```

Cover:

- `commands:execute` calls command service
- command events are sent to the originating window
- destroyed windows do not receive events
- `shell:create-session` creates a PTY session through the shell service
- shell data and exit events are sent to the originating window
- destroyed windows do not receive shell events
- shell sessions are killed when the originating renderer is destroyed

Add tests for the Electron shell service:

```text
ecos/gui/apps/desktop-electron/electron/services/shellPtyService.test.ts
```

Cover:

- chooses the user's shell from `SHELL` or `COMSPEC`
- forwards PTY data and exit events with the session id
- delegates write, resize, and kill to the active PTY
- rejects writes, resizes, or kills for unknown sessions

### Component tests

Add:

```text
ecos/gui/apps/renderer/src/components/ECOSTerminal.test.ts
```

Cover:

- renders collapsed/expanded state if terminal panel owns its own chrome
- writes welcome/help text
- sends parsed command to desktop API
- prints command result
- handles command errors
- clears output on `clear`
- exposes shell mode through the desktop shell API

Mock xterm.js in tests. Do not rely on canvas/DOM internals.

### Existing tests to run

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

### Manual acceptance

Verify in Electron dev app:

- Terminal opens and closes from the bottom panel.
- Typing `help` prints available ECOS commands.
- Typing `ecos run-step place` calls the same backend behavior as the Run Step button.
- Typing `ecos run-all` calls the same backend behavior as Run All.
- GUI buttons still work.
- Route changes do not destroy terminal history.
- Window resize keeps the terminal fitted.
- No shell/system command runs from ECOS command mode.
- Switching to Shell starts a real shell through `node-pty`.
- Shell output appears in the terminal.
- Typing `exit` reports the shell exit code.
- Switching back to ECOS mode kills the shell session.

## Assumptions and defaults

- v1 uses `@xterm/xterm` for VS Code style terminal rendering.
- v3 uses `node-pty` in desktop Electron main only.
- v1 keeps `ecos/server` running behind the Command Bus adapter.
- The first terminal is app-level and collapsible, not a HomeView-only panel.
- The renderer never receives direct `node-pty`, filesystem, Python, or raw IPC access.
- GUI buttons and terminal commands converge through `window.ecosDesktop.commands.execute`.
- Full shell sessions use `window.ecosDesktop.shell`, not the command bus.
- Browser-only renderer fallback can keep current HTTP behavior for development.
- Removing FastAPI is a later migration after Command Bus is stable.
