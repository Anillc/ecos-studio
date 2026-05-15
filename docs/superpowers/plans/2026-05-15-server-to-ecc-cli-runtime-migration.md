# Server to ECC CLI Runtime Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the desktop GUI's long-term dependency on `ecos/server` with an Electron-managed runtime that executes ECC through the ECC CLI or a Python worker process.

**Architecture:** Renderer code talks only to narrow preload bridge APIs. Electron main owns desktop runtime coordination, job/process lifecycle, terminal sessions, and event forwarding. ECC CLI or a Python worker owns `chipcompiler` execution, including workspace creation, flow execution, step state, logs, and machine-readable results.

**Tech Stack:** Electron main/preload, Vue renderer, TypeScript shared contracts, Node `child_process`, `node-pty`, Python ECC CLI, `chipcompiler`, Vitest, pytest.

---

## Summary

The migration should not remove `ecos/server` in one jump. The safe path is to first make the renderer depend on a desktop bridge, then make ECC CLI capable enough to replace the FastAPI API, then switch the bridge adapter from FastAPI to CLI, and only then stop launching the server in the desktop app.

The final shape should be:

```text
Renderer GUI / ECOSTerminal
  -> preload bridge
  -> Electron main DesktopRuntimeManager
  -> EccCliAdapter / Python worker process
  -> chipcompiler
```

The key boundary is:

- Electron main manages runtime shell concerns: job ids, process lifecycle, cancellation, stdout/stderr forwarding, active workspace metadata, concurrency guards, app/window cleanup.
- ECC CLI manages ECC execution: `Workspace`, `EngineFlow`, `run_step`, `rtl2gds`, `get_info`, workspace files, logs, and JSON/event output.
- `chipcompiler` remains a core Python library. It should not know about Electron, IPC, HTTP, or GUI state.

## Naming

Avoid calling this work `Resource Manager`. The old resource manager work was about external dependencies such as PDKs, Yosys, registries, downloads, installs, and inventory. This migration is about runtime execution.

Preferred names:

- `DesktopRuntimeManager`
- `DesktopRuntimeJob`
- `DesktopRuntimeEvent`
- `ApiCompatAdapter`
- `EccCliAdapter`
- `EccExecutionManager` if a Python-side orchestration layer is needed

## Migration Phases

### Phase 1: Keep Server as Compatibility Adapter

**Goal:** Move renderer GUI command execution behind the Electron desktop bridge without changing user-visible behavior.

Current path:

```text
Renderer API wrappers
  -> HTTP client
  -> ecos/server FastAPI
  -> ECCService
  -> chipcompiler
```

Phase 1 path:

```text
Renderer API wrappers
  -> window.ecosDesktop.cli.execute(...)
  -> DesktopRuntimeManager
  -> ApiCompatAdapter
  -> ecos/server FastAPI
  -> ECCService
  -> chipcompiler
```

**Responsibilities:**

- Keep `ecos/server` and `ApiServerService` running.
- Keep existing workspace, flow, and info behavior unchanged.
- Add a desktop runtime contract that can later point to CLI instead of HTTP.
- Keep the terminal as a real shell path. The terminal should not call `window.ecosDesktop.cli.execute`.

**Files expected to participate:**

- `ecos/gui/packages/shared/src/contracts/desktopCli.ts`
- `ecos/gui/packages/shared/src/contracts/desktopApi.ts`
- `ecos/gui/packages/shared/src/constants/ipcChannels.ts`
- `ecos/gui/apps/desktop-electron/electron/services/desktopCliBridgeService.ts`
- `ecos/gui/apps/desktop-electron/electron/services/apiCliAdapter.ts`
- `ecos/gui/apps/desktop-electron/electron/main/registerIpc.ts`
- `ecos/gui/apps/desktop-electron/electron/preload/index.ts`
- Renderer API wrapper files that currently call `/api/workspace/*`

**Acceptance criteria:**

- Existing GUI buttons still work through the FastAPI compatibility adapter.
- Renderer code no longer needs to know whether desktop execution is HTTP-backed or CLI-backed.
- The desktop bridge emits normalized lifecycle events for command execution.
- Existing renderer and desktop Electron tests pass.

### Phase 2: Add ECC CLI Subcommands and JSON/Event Output

**Goal:** Make the ECC CLI cover every workspace and flow operation currently used by the GUI.

Required command surface:

```bash
ecc workspace create --json --workspace <path> --rtl <path-or-filelist> --design <name> --top <module> --clock <clock> --pdk-root <path> [--freq <mhz>]
ecc workspace load --json --workspace <path>
ecc workspace delete --json --workspace <path>
ecc pdk set-root --json --pdk ics55 --path <path>
ecc flow run --json --workspace <path> [--rerun]
ecc flow run-step --json --workspace <path> --step <step> [--rerun]
ecc info get --json --workspace <path> --step <step> --id <info-id>
ecc home get --json --workspace <path>
```

The CLI should support human-readable output by default and machine-readable output when `--json` is present.

JSON lines output format:

```json
{"type":"event","jobId":"job-1","phase":"started","cmd":"flow.run-step","data":{"step":"synthesis"}}
{"type":"event","jobId":"job-1","phase":"stdout","cmd":"flow.run-step","text":"Running synthesis..."}
{"type":"result","jobId":"job-1","ok":true,"cmd":"flow.run-step","response":"success","data":{"step":"synthesis","state":"Success"},"message":["run step synthesis success"]}
```

**Responsibilities:**

- Extend the existing ECC CLI instead of creating a second CLI.
- Keep `chipcompiler` execution inside Python.
- Add a small response/event schema that maps cleanly to the existing desktop bridge result shape.
- Return non-zero exit codes for failed or errored commands.
- Keep command behavior deterministic enough for Electron to parse stdout.

**Files expected to participate:**

- `ecc/chipcompiler/cli/main.py`
- `ecc/chipcompiler/cli/` new focused modules if the current CLI grows too large
- `ecc/test/cli/test_cli_main.py`
- New CLI tests under `ecc/test/cli/`
- Potential shared Python helper around current server logic if code is extracted from `ecos/server/ecos_server/ecc/services/ecc.py`

**Acceptance criteria:**

- `ecc ... --json` can create/load/delete workspaces, set PDK root, run full flow, run one step, fetch info, and fetch home data without starting `ecos/server`.
- Long-running commands emit JSON event lines before the final result line.
- Tests cover success, validation failure, command failure, and JSON parsing shape.

### Phase 3: Switch Desktop Runtime from API Adapter to ECC CLI Adapter

**Goal:** Make GUI button execution use ECC CLI through Electron main.

Target path:

```text
Renderer API wrappers
  -> window.ecosDesktop.cli.execute(...)
  -> DesktopRuntimeManager
  -> EccCliAdapter
  -> child_process.spawn("ecc", ...)
  -> chipcompiler
```

**Responsibilities:**

- Add `EccCliAdapter` in Electron main.
- Keep `ApiCompatAdapter` behind a backend switch while CLI rollout is being verified.
- Make `DesktopRuntimeManager` the only place that tracks active jobs and maps adapter events to renderer events.
- Support cancellation by killing the child process for the active job.
- Guard long-running flow jobs so the same workspace cannot run conflicting commands concurrently.
- Parse JSON lines from CLI stdout; forward non-JSON stdout as normal output events.
- Normalize CLI exit code and final result into the existing desktop result contract.

**Suggested backend switch:**

```text
ECOS_RUNTIME_BACKEND=api
ECOS_RUNTIME_BACKEND=cli
```

Default during rollout: `api`.

Default after CLI parity: `cli`.

**Files expected to participate:**

- `ecos/gui/apps/desktop-electron/electron/services/desktopRuntimeManager.ts`
- `ecos/gui/apps/desktop-electron/electron/services/eccCliAdapter.ts`
- `ecos/gui/apps/desktop-electron/electron/services/apiCliAdapter.ts`
- `ecos/gui/apps/desktop-electron/electron/main/index.ts`
- `ecos/gui/apps/desktop-electron/electron/main/registerIpc.ts`
- `ecos/gui/apps/desktop-electron/electron/preload/index.ts`
- `ecos/gui/packages/shared/src/contracts/desktopCli.ts`
- `ecos/gui/packages/shared/src/contracts/desktopApi.ts`

**Acceptance criteria:**

- With `ECOS_RUNTIME_BACKEND=cli`, GUI workspace and flow actions work without using `/api/workspace/*`.
- Electron forwards CLI stdout/stderr to the renderer event stream.
- Killing or cancelling a job updates renderer state and does not leave a tracked active job.
- CLI crash or malformed JSON produces a structured error result instead of crashing Electron.
- Tests cover adapter command mapping, JSON line parsing, process failure, cancellation, and concurrency rejection.

### Phase 4: Stop Launching and Remove Desktop Dependence on `ecos/server`

**Goal:** Remove FastAPI server from the normal desktop runtime path.

**Responsibilities:**

- Stop launching `ecos/server` from the desktop app.
- Remove `ApiServerService` from normal app startup.
- Remove or narrow browser-only HTTP fallbacks that exist only for the old server path.
- Delete `apiCliAdapter` after the CLI adapter is the default and stable.
- Move any server-only behavior still needed by the GUI into ECC CLI or a Python-side execution layer.
- Update docs to describe the CLI-based runtime model.

**Files expected to participate:**

- `ecos/gui/apps/desktop-electron/electron/services/apiServerService.ts`
- `ecos/gui/apps/desktop-electron/electron/main/index.ts`
- `ecos/gui/apps/desktop-electron/electron/services/apiCliAdapter.ts`
- Renderer API wrapper files with HTTP fallback logic
- `ecos/server/ecos_server/ecc/services/ecc.py` if logic is extracted or retired
- Desktop packaging scripts that include server assets
- User/developer docs that mention desktop FastAPI startup

**Acceptance criteria:**

- Desktop startup no longer spawns FastAPI.
- GUI workspace and flow tests pass with CLI backend as the default.
- Packaging no longer requires server runtime assets for normal desktop use.
- Remaining server code is either deleted or documented as standalone legacy/dev-only code.

## Runtime Contract

The bridge contract should stay stable across phases.

Command request:

```ts
export interface DesktopCliCommandRequest {
  cmd: DesktopCliCommandName
  data: Record<string, unknown>
  source: 'button' | 'menu' | 'terminal' | 'test'
}
```

Command result:

```ts
export interface DesktopCliCommandResult {
  ok: boolean
  cmd: DesktopCliCommandName
  response: 'success' | 'failed' | 'error' | 'warning' | 'cancelled'
  data: Record<string, unknown>
  message: string[]
}
```

Runtime event:

```ts
export interface DesktopRuntimeEvent {
  jobId: string
  cmd: DesktopCliCommandName
  type: 'queued' | 'started' | 'stdout' | 'stderr' | 'completed' | 'failed' | 'cancelled'
  stream?: 'stdout' | 'stderr' | 'system'
  text?: string
  result?: DesktopCliCommandResult
}
```

## Desktop Runtime Rules

- Renderer never imports Node, Python, `child_process`, `node-pty`, or filesystem APIs.
- Renderer sees only `window.ecosDesktop.cli` and `window.ecosDesktop.shell`.
- Terminal input goes to the shell service. GUI button execution goes to the runtime command bridge.
- Electron main never imports `chipcompiler` directly.
- Electron main may spawn CLI or worker processes and must own their lifecycle.
- ECC CLI owns `Workspace`, `EngineFlow`, step execution, and result generation.
- A long-running flow job must have a job id before process spawn.
- Active jobs must be cleared on normal exit, process error, cancellation, renderer destruction, and app quit.
- Structured JSON events should be preferred. Plain stdout/stderr must still be forwarded so users can diagnose failures.

## Task Breakdown

### Task 1: Define Runtime Contract Names

**Files:**

- Modify: `ecos/gui/packages/shared/src/contracts/desktopCli.ts`
- Modify: `ecos/gui/packages/shared/src/contracts/desktopApi.ts`
- Modify: `ecos/gui/packages/shared/src/index.ts`

- [ ] Confirm `DesktopCliCommandRequest`, `DesktopCliCommandResult`, and runtime event types match the contract in this plan.
- [ ] Rename generic `command bus` wording to `desktop runtime` or `desktop cli bridge`.
- [ ] Run:

```bash
pnpm --filter @ecos-studio/renderer run typecheck
pnpm --filter @ecos-studio/desktop-electron run typecheck
```

Expected: both typecheck commands pass.

- [ ] Commit:

```bash
git add ecos/gui/packages/shared
git commit -m "refactor(gui): define desktop runtime contracts"
```

### Task 2: Build `DesktopRuntimeManager` Around the Existing API Adapter

**Files:**

- Create: `ecos/gui/apps/desktop-electron/electron/services/desktopRuntimeManager.ts`
- Modify: `ecos/gui/apps/desktop-electron/electron/services/desktopCliBridgeService.ts`
- Test: `ecos/gui/apps/desktop-electron/electron/services/desktopRuntimeManager.test.ts`

- [ ] Add tests for job id creation, lifecycle events, adapter success, adapter error, and long-running command rejection.
- [ ] Implement `DesktopRuntimeManager` with a replaceable adapter interface.
- [ ] Keep `apiCliAdapter` as the Phase 1 adapter.
- [ ] Run:

```bash
pnpm --filter @ecos-studio/desktop-electron run test -- desktopRuntimeManager
```

Expected: new runtime manager tests pass.

- [ ] Commit:

```bash
git add ecos/gui/apps/desktop-electron/electron/services
git commit -m "feat(gui): add desktop runtime manager"
```

### Task 3: Extend ECC CLI Command Surface

**Files:**

- Modify: `ecc/chipcompiler/cli/main.py`
- Create or modify focused modules under: `ecc/chipcompiler/cli/`
- Test: `ecc/test/cli/test_cli_main.py`

- [ ] Add pytest coverage for `workspace create`, `workspace load`, `flow run-step`, `flow run`, `info get`, and `home get` with `--json`.
- [ ] Refactor CLI parsing from one flat command into subcommands.
- [ ] Keep the current full RTL2GDS behavior available through `ecc flow run` or a compatible wrapper.
- [ ] Add JSON result output and non-zero exit codes on failure.
- [ ] Run:

```bash
cd ecc
uv run pytest test/cli -q
```

Expected: CLI tests pass.

- [ ] Commit:

```bash
git add ecc/chipcompiler/cli ecc/test/cli
git commit -m "feat(ecc): add gui-compatible cli subcommands"
```

### Task 4: Add CLI JSON Event Output

**Files:**

- Modify: `ecc/chipcompiler/cli/`
- Test: `ecc/test/cli/`

- [ ] Add tests that assert long-running commands can emit JSON event lines before the final result.
- [ ] Emit `started`, `stdout`, `stderr`, `completed`, `failed`, and `cancelled`-compatible events where the CLI can observe them.
- [ ] Keep human-readable output as the default when `--json` is not present.
- [ ] Run:

```bash
cd ecc
uv run pytest test/cli -q
```

Expected: CLI event output tests pass.

- [ ] Commit:

```bash
git add ecc/chipcompiler/cli ecc/test/cli
git commit -m "feat(ecc): emit json events from cli commands"
```

### Task 5: Add `EccCliAdapter` in Electron Main

**Files:**

- Create: `ecos/gui/apps/desktop-electron/electron/services/eccCliAdapter.ts`
- Test: `ecos/gui/apps/desktop-electron/electron/services/eccCliAdapter.test.ts`
- Modify: `ecos/gui/apps/desktop-electron/electron/services/desktopRuntimeManager.ts`

- [ ] Add tests for command-to-argv mapping.
- [ ] Add tests for JSON line parsing.
- [ ] Add tests for plain stdout/stderr forwarding.
- [ ] Add tests for process exit code failure and malformed JSON.
- [ ] Implement `EccCliAdapter` with `child_process.spawn`.
- [ ] Run:

```bash
pnpm --filter @ecos-studio/desktop-electron run test -- eccCliAdapter
```

Expected: adapter tests pass.

- [ ] Commit:

```bash
git add ecos/gui/apps/desktop-electron/electron/services/eccCliAdapter.ts ecos/gui/apps/desktop-electron/electron/services/eccCliAdapter.test.ts
git commit -m "feat(gui): add ecc cli adapter"
```

### Task 6: Add Runtime Backend Switch

**Files:**

- Modify: `ecos/gui/apps/desktop-electron/electron/main/index.ts`
- Modify: `ecos/gui/apps/desktop-electron/electron/services/desktopRuntimeManager.ts`
- Test: `ecos/gui/apps/desktop-electron/electron/main/registerIpc.test.ts`

- [ ] Add tests that `ECOS_RUNTIME_BACKEND=api` selects the API adapter.
- [ ] Add tests that `ECOS_RUNTIME_BACKEND=cli` selects the ECC CLI adapter.
- [ ] Default to `api` until CLI parity is verified.
- [ ] Run:

```bash
pnpm --filter @ecos-studio/desktop-electron run test
```

Expected: desktop Electron tests pass.

- [ ] Commit:

```bash
git add ecos/gui/apps/desktop-electron/electron
git commit -m "feat(gui): select desktop runtime backend"
```

### Task 7: Switch Desktop Default to CLI

**Files:**

- Modify: `ecos/gui/apps/desktop-electron/electron/main/index.ts`
- Modify: desktop packaging or env defaults if present
- Test: desktop Electron tests and renderer integration tests

- [ ] Run the GUI command flow with `ECOS_RUNTIME_BACKEND=cli`.
- [ ] Confirm create/load/run-step/rtl2gds/get-info work without using `/api/workspace/*`.
- [ ] Change the desktop default backend from `api` to `cli`.
- [ ] Keep `api` override available for one release cycle.
- [ ] Run:

```bash
pnpm --filter @ecos-studio/desktop-electron run typecheck
pnpm --filter @ecos-studio/desktop-electron run test
pnpm --filter @ecos-studio/renderer run typecheck
pnpm --filter @ecos-studio/renderer run test
```

Expected: desktop and renderer verification pass.

- [ ] Commit:

```bash
git add ecos/gui/apps/desktop-electron ecos/gui/apps/renderer ecos/gui/packages/shared
git commit -m "feat(gui): default desktop runtime to ecc cli"
```

### Task 8: Retire Desktop FastAPI Startup

**Files:**

- Modify or delete: `ecos/gui/apps/desktop-electron/electron/services/apiServerService.ts`
- Modify: `ecos/gui/apps/desktop-electron/electron/main/index.ts`
- Modify: packaging scripts that include server runtime assets
- Modify: docs that mention desktop FastAPI startup

- [ ] Remove FastAPI startup from the normal Electron app boot path.
- [ ] Keep server code only if it is explicitly documented as standalone legacy or dev-only.
- [ ] Remove `ApiCompatAdapter` once there is no supported desktop fallback.
- [ ] Run:

```bash
pnpm --filter @ecos-studio/desktop-electron run typecheck
pnpm --filter @ecos-studio/desktop-electron run test
pnpm --filter @ecos-studio/renderer run typecheck
pnpm --filter @ecos-studio/renderer run test
cd ecc && uv run pytest test/cli -q
```

Expected: all runtime, renderer, and CLI tests pass without starting `ecos/server`.

- [ ] Commit:

```bash
git add ecos/gui/apps/desktop-electron ecos/gui/apps/renderer ecos/gui/packages/shared ecc
git commit -m "refactor(gui): retire desktop fastapi runtime"
```

## Risk Notes

- The largest risk is moving stateful behavior out of `ECCService` too quickly. Keep compatibility until CLI parity is proven.
- Avoid putting `chipcompiler` execution inside Electron main. Long-running EDA execution belongs in a child process.
- The terminal and GUI button path should share ECC CLI capability, but they should not share the same renderer-side command parser.
- JSON output must stay stable. Electron should treat malformed JSON as an adapter error and still forward raw text for debugging.
- Cancellation should be designed early. Adding it after process management is already spread across files will be painful.

## PR Sequence

1. `feat(gui): add desktop runtime compatibility layer`
2. `feat(ecc): add gui-compatible cli subcommands`
3. `feat(gui): execute ecc commands through cli adapter`
4. `refactor(gui): retire desktop fastapi runtime`

Each PR should be independently testable and should leave the app runnable.

## Completion Criteria

- GUI buttons execute through `DesktopRuntimeManager`.
- ECC CLI can perform the full workspace and flow command set without `ecos/server`.
- Electron main can spawn, observe, cancel, and clean up ECC CLI jobs.
- The desktop app no longer starts FastAPI for normal GUI operation.
- `ecos/server` is either removed from the desktop runtime or clearly marked as legacy/dev-only.
