import type {
  DesktopCommandName,
  DesktopCommandRequest,
  DesktopCommandResult,
} from '@ecos-studio/shared'

const API_HOST = '127.0.0.1'

const commandEndpointByName: Partial<Record<DesktopCommandName, string>> = {
  create_workspace: '/api/workspace/create_workspace',
  get_info: '/api/workspace/get_info',
  home_page: '/api/workspace/get_home_page',
  load_workspace: '/api/workspace/load_workspace',
  rtl2gds: '/api/workspace/rtl2gds',
  run_step: '/api/workspace/run_step',
  set_pdk_root: '/api/workspace/set_pdk_root',
}

export interface ApiCommandPortProvider {
  getPort(): Promise<number>
}

export interface ApiCommandAdapterOptions {
  fetch?: typeof fetch
  portProvider: ApiCommandPortProvider
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {}
}

function readMessage(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item))
  }

  if (typeof value === 'string' && value.trim()) {
    return [value]
  }

  return []
}

function normalizeResult(
  request: DesktopCommandRequest,
  payload: unknown,
): DesktopCommandResult {
  const record = readRecord(payload)
  const response = record.response === 'success'
    || record.response === 'failed'
    || record.response === 'error'
    || record.response === 'warning'
    ? record.response
    : 'error'
  const cmd = typeof record.cmd === 'string' ? record.cmd as DesktopCommandName : request.cmd

  return {
    cmd,
    data: readRecord(record.data),
    message: readMessage(record.message),
    ok: response === 'success',
    response,
  }
}

function createErrorResult(
  request: DesktopCommandRequest,
  message: string,
): DesktopCommandResult {
  return {
    cmd: request.cmd,
    data: {},
    message: [message],
    ok: false,
    response: 'error',
  }
}

export class ApiCommandAdapter {
  private readonly fetchImpl: typeof fetch
  private readonly portProvider: ApiCommandPortProvider

  constructor(options: ApiCommandAdapterOptions) {
    this.fetchImpl = options.fetch ?? fetch
    this.portProvider = options.portProvider
  }

  async execute(request: DesktopCommandRequest): Promise<DesktopCommandResult> {
    const endpoint = commandEndpointByName[request.cmd]

    if (!endpoint) {
      return createErrorResult(request, `Command "${request.cmd}" cannot be sent to the API adapter.`)
    }

    try {
      const port = await this.portProvider.getPort()
      const response = await this.fetchImpl(`http://${API_HOST}:${port}${endpoint}`, {
        body: JSON.stringify({
          cmd: request.cmd,
          data: request.data,
        }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })

      if (!response.ok) {
        return createErrorResult(
          request,
          `FastAPI request failed with HTTP ${response.status}.`,
        )
      }

      return normalizeResult(request, await response.json())
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return createErrorResult(request, message)
    }
  }
}
