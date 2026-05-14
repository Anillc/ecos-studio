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
