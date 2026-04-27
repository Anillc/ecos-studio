import { contextBridge, ipcRenderer } from 'electron'
import { desktopApiIpcChannels, type DesktopApi } from '@ecos-studio/shared'

const desktopApi: DesktopApi = {
  window: {
    minimize: () => ipcRenderer.invoke(desktopApiIpcChannels.windowMinimize),
    toggleMaximize: () => ipcRenderer.invoke(desktopApiIpcChannels.windowToggleMaximize),
    close: () => ipcRenderer.invoke(desktopApiIpcChannels.windowClose),
    setTitle: (title) => ipcRenderer.invoke(desktopApiIpcChannels.windowSetTitle, title),
    isMaximized: () => ipcRenderer.invoke(desktopApiIpcChannels.windowIsMaximized),
  },
  system: {
    openExternal: (url) => ipcRenderer.invoke(desktopApiIpcChannels.systemOpenExternal, url),
  },
  workspace: {
    loadRecent: () => ipcRenderer.invoke(desktopApiIpcChannels.workspaceLoadRecent),
    openProject: () => ipcRenderer.invoke(desktopApiIpcChannels.workspaceOpen),
  },
  tiles: {
    generate: (request) => ipcRenderer.invoke(desktopApiIpcChannels.tilesGenerate, request),
  },
}

contextBridge.exposeInMainWorld('ecosDesktop', desktopApi)
