import { randomUUID } from 'node:crypto'
import type {
  DesktopCliCommandEvent,
  DesktopCliCommandName,
  DesktopCliCommandRequest,
  DesktopCliCommandResult,
} from '@ecos-studio/shared'

export interface DesktopCliAdapter {
  execute(request: DesktopCliCommandRequest): Promise<DesktopCliCommandResult>
}

export type DesktopCliEventListener = (event: DesktopCliCommandEvent) => void

export interface DesktopCliBridgeServiceOptions {
  adapter: DesktopCliAdapter
}

const supportedCommands = new Set<DesktopCliCommandName>([
  'help',
  'clear',
  'load_workspace',
  'create_workspace',
  'set_pdk_root',
  'run_step',
  'rtl2gds',
  'get_info',
  'home_page',
])

const longRunningCommands = new Set<DesktopCliCommandName>([
  'create_workspace',
  'load_workspace',
  'run_step',
  'rtl2gds',
])

function isSupportedCommand(cmd: string): cmd is DesktopCliCommandName {
  return supportedCommands.has(cmd as DesktopCliCommandName)
}

function createResult(
  cmd: DesktopCliCommandName,
  response: DesktopCliCommandResult['response'],
  message: string[],
): DesktopCliCommandResult {
  return {
    cmd,
    data: {},
    message,
    ok: response === 'success',
    response,
  }
}

export class DesktopCliBridgeService {
  private readonly adapter: DesktopCliAdapter
  private activeLongRunningJobId: string | null = null
  private readonly listeners = new Set<DesktopCliEventListener>()

  constructor(options: DesktopCliBridgeServiceOptions) {
    this.adapter = options.adapter
  }

  onEvent(listener: DesktopCliEventListener): () => void {
    this.listeners.add(listener)

    return () => {
      this.listeners.delete(listener)
    }
  }

  private emit(event: DesktopCliCommandEvent, listener?: DesktopCliEventListener): void {
    listener?.(event)
    for (const registeredListener of this.listeners) {
      registeredListener(event)
    }
  }

  async execute(
    request: DesktopCliCommandRequest,
    listener?: DesktopCliEventListener,
  ): Promise<DesktopCliCommandResult> {
    if (!isSupportedCommand(request.cmd)) {
      return {
        cmd: request.cmd as DesktopCliCommandName,
        data: {},
        message: [`Unknown command: ${request.cmd}`],
        ok: false,
        response: 'error',
      }
    }

    const jobId = randomUUID()
    const isLongRunning = longRunningCommands.has(request.cmd)

    if (isLongRunning && this.activeLongRunningJobId) {
      return createResult(
        request.cmd,
        'warning',
        ['Another ECOS command is already running. Wait for it to finish before starting a new one.'],
      )
    }

    if (isLongRunning) {
      this.activeLongRunningJobId = jobId
    }

    this.emit({
      cmd: request.cmd,
      jobId,
      stream: 'system',
      text: `Started ${request.cmd}`,
      type: 'started',
    }, listener)

    try {
      const result = request.cmd === 'help'
        ? createResult(request.cmd, 'success', ['Type "ecos help" to list available commands.'])
        : request.cmd === 'clear'
          ? createResult(request.cmd, 'success', [])
          : await this.adapter.execute(request)
      this.emit({
        cmd: request.cmd,
        jobId,
        result,
        stream: result.ok ? 'system' : result.response === 'warning' ? 'system' : 'stderr',
        text: result.message.join('\n'),
        type: result.ok ? 'completed' : 'failed',
      }, listener)
      return result
    } catch (error) {
      const result = createResult(
        request.cmd,
        'error',
        [error instanceof Error ? error.message : String(error)],
      )
      this.emit({
        cmd: request.cmd,
        jobId,
        result,
        stream: 'stderr',
        text: result.message.join('\n'),
        type: 'failed',
      }, listener)
      return result
    } finally {
      if (this.activeLongRunningJobId === jobId) {
        this.activeLongRunningJobId = null
      }
    }
  }
}
