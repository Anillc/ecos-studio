export const ipcChannels = {
  appReady: 'app:ready',
  windowMinimize: 'window:minimize',
  windowToggleMaximize: 'window:toggle-maximize',
  windowClose: 'window:close',
  workspaceOpen: 'workspace:open',
  workspaceCreate: 'workspace:create',
  workspaceLoadRecent: 'workspace:load-recent',
  workspaceSetProjectRoot: 'workspace:set-project-root',
  tilesGenerate: 'tiles:generate',
  systemOpenExternal: 'system:open-external',
} as const

export type IpcChannel = (typeof ipcChannels)[keyof typeof ipcChannels]
