export type DesktopErrorCode =
  | 'DESKTOP_BRIDGE_UNAVAILABLE'
  | 'INVALID_PROJECT_DIRECTORY'
  | 'PROJECT_SCOPE_DENIED'
  | 'SETTINGS_WRITE_FAILED'
  | 'TILE_GENERATION_FAILED'

export interface DesktopErrorShape {
  code: DesktopErrorCode
  message: string
  detail?: string
}
