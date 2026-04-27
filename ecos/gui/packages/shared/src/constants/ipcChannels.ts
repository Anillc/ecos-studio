export const desktopApiIpcChannels = {
  windowMinimize: 'window:minimize',
  windowToggleMaximize: 'window:toggle-maximize',
  windowClose: 'window:close',
  windowSetTitle: 'window:set-title',
  windowIsMaximized: 'window:is-maximized',
  workspaceOpen: 'workspace:open',
  workspaceLoadRecent: 'workspace:load-recent',
  tilesGenerate: 'tiles:generate',
  systemOpenExternal: 'system:open-external',
} as const

export const ipcChannels = {
  appReady: 'app:ready',
  ...desktopApiIpcChannels,
  workspaceCreate: 'workspace:create',
  workspaceSetProjectRoot: 'workspace:set-project-root',
} as const

export type DesktopApiIpcChannel =
  (typeof desktopApiIpcChannels)[keyof typeof desktopApiIpcChannels]

export type IpcChannel = (typeof ipcChannels)[keyof typeof ipcChannels]
