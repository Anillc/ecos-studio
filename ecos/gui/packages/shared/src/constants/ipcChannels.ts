export const desktopApiIpcChannels = {
  windowMinimize: 'window:minimize',
  windowToggleMaximize: 'window:toggle-maximize',
  windowClose: 'window:close',
  windowConfirmClose: 'window:confirm-close',
  windowSetTitle: 'window:set-title',
  windowIsMaximized: 'window:is-maximized',
  workspaceOpen: 'workspace:open',
  workspaceLoadRecent: 'workspace:load-recent',
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
