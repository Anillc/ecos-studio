export type DesktopCommandName =
  | 'help'
  | 'clear'
  | 'load_workspace'
  | 'create_workspace'
  | 'set_pdk_root'
  | 'run_step'
  | 'rtl2gds'
  | 'get_info'
  | 'home_page'

export type DesktopCommandSource = 'button' | 'terminal'

export type DesktopCommandResponse = 'success' | 'failed' | 'error' | 'warning'

export interface DesktopCommandRequest {
  cmd: DesktopCommandName
  data: Record<string, unknown>
  source: DesktopCommandSource
}

export interface DesktopCommandResult {
  ok: boolean
  cmd: DesktopCommandName
  response: DesktopCommandResponse
  data: Record<string, unknown>
  message: string[]
}

export interface DesktopCommandEvent {
  jobId: string
  type: 'started' | 'output' | 'completed' | 'failed'
  cmd: DesktopCommandName
  stream?: 'stdout' | 'stderr' | 'system'
  text?: string
  result?: DesktopCommandResult
}
