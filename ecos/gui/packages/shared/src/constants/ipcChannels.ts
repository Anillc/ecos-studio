export const desktopApiIpcChannels = {
  windowMinimize: 'window:minimize',
  windowToggleMaximize: 'window:toggle-maximize',
  windowClose: 'window:close',
  windowConfirmClose: 'window:confirm-close',
  windowSetTitle: 'window:set-title',
  windowIsMaximized: 'window:is-maximized',
  settingsGet: 'settings:get',
  settingsSet: 'settings:set',
  settingsDelete: 'settings:delete',
  dialogPickDirectory: 'dialog:pick-directory',
  workspaceGetApiPort: 'workspace:get-api-port',
  workspaceIsProjectDirectory: 'workspace:is-project-directory',
  workspaceRegisterProjectRoot: 'workspace:register-project-root',
  workspaceClearProjectRoot: 'workspace:clear-project-root',
  workspaceRequestProjectPathAccess: 'workspace:request-project-path-access',
  workspaceScanPdkDirectory: 'workspace:scan-pdk-directory',
  tilesGenerate: 'tiles:generate',
  systemOpenExternal: 'system:open-external',
} as const

export const desktopApiEventChannels = {
  menuAction: 'menu:action',
  windowCloseRequested: 'window:close-requested',
  windowResized: 'window:resized',
  windowMaximizedChanged: 'window:maximized-changed',
} as const

export const ipcChannels = {
  appReady: 'app:ready',
  ...desktopApiIpcChannels,
  workspaceCreate: 'workspace:create',
  workspaceSetProjectRoot: 'workspace:set-project-root',
} as const

export type DesktopApiIpcChannel =
  (typeof desktopApiIpcChannels)[keyof typeof desktopApiIpcChannels]

export type DesktopApiEventChannel =
  (typeof desktopApiEventChannels)[keyof typeof desktopApiEventChannels]

export type IpcChannel = (typeof ipcChannels)[keyof typeof ipcChannels]
