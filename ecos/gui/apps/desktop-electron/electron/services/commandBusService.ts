import { randomUUID } from 'node:crypto'
import type {
  DesktopCommandEvent,
  DesktopCommandName,
  DesktopCommandRequest,
  DesktopCommandResult,
} from '@ecos-studio/shared'

export interface CommandAdapter {
  execute(request: DesktopCommandRequest): Promise<DesktopCommandResult>
}

export type CommandEventListener = (event: DesktopCommandEvent) => void

export interface CommandBusServiceOptions {
  adapter: CommandAdapter
}

const supportedCommands = new Set<DesktopCommandName>([
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

const longRunningCommands = new Set<DesktopCommandName>([
  'create_workspace',
  'load_workspace',
  'run_step',
  'rtl2gds',
])

function isSupportedCommand(cmd: string): cmd is DesktopCommandName {
  return supportedCommands.has(cmd as DesktopCommandName)
}

function createResult(
  cmd: DesktopCommandName,
  response: DesktopCommandResult['response'],
  message: string[],
): DesktopCommandResult {
  return {
    cmd,
    data: {},
    message,
    ok: response === 'success',
    response,
  }
}

export class CommandBusService {
  private readonly adapter: CommandAdapter
  private activeLongRunningJobId: string | null = null
  private readonly listeners = new Set<CommandEventListener>()

  constructor(options: CommandBusServiceOptions) {
    this.adapter = options.adapter
  }

  onEvent(listener: CommandEventListener): () => void {
    this.listeners.add(listener)

    return () => {
      this.listeners.delete(listener)
    }
  }

  private emit(event: DesktopCommandEvent, listener?: CommandEventListener): void {
    listener?.(event)
    for (const registeredListener of this.listeners) {
      registeredListener(event)
    }
  }

  async execute(
    request: DesktopCommandRequest,
    listener?: CommandEventListener,
  ): Promise<DesktopCommandResult> {
    if (!isSupportedCommand(request.cmd)) {
      return {
        cmd: request.cmd as DesktopCommandName,
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
