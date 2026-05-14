export interface DesktopShellSessionOptions {
  cols: number
  cwd?: string
  rows: number
}

export interface DesktopShellSession {
  pid: number
  sessionId: string
  shell: string
}

export interface DesktopShellDataEvent {
  data: string
  sessionId: string
}

export interface DesktopShellExitEvent {
  exitCode: number
  sessionId: string
  signal?: number
}
