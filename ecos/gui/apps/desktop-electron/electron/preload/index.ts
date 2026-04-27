import { contextBridge, ipcRenderer } from 'electron'
import {
  desktopApiEventChannels,
  desktopApiIpcChannels,
  type DesktopApi,
  type DesktopMenuEventId,
} from '@ecos-studio/shared'

function subscribeToDesktopEvent(
  channel: string,
  listener: (...args: unknown[]) => void,
): () => void {
  ipcRenderer.on(channel, listener)

  return () => {
    ipcRenderer.removeListener(channel, listener)
  }
}

const desktopApi: DesktopApi = {
  window: {
    minimize: () => ipcRenderer.invoke(desktopApiIpcChannels.windowMinimize),
    toggleMaximize: () => ipcRenderer.invoke(desktopApiIpcChannels.windowToggleMaximize),
    close: () => ipcRenderer.invoke(desktopApiIpcChannels.windowClose),
    setTitle: (title) => ipcRenderer.invoke(desktopApiIpcChannels.windowSetTitle, title),
    isMaximized: () => ipcRenderer.invoke(desktopApiIpcChannels.windowIsMaximized),
    onResized: (listener) =>
      subscribeToDesktopEvent(desktopApiEventChannels.windowResized, () => {
        listener()
      }),
    onMaximizedChanged: (listener) =>
      subscribeToDesktopEvent(
        desktopApiEventChannels.windowMaximizedChanged,
        (_event, isMaximized: unknown) => {
          listener(Boolean(isMaximized))
        },
      ),
  },
  menu: {
    onAction: (listener) =>
      subscribeToDesktopEvent(
        desktopApiEventChannels.menuAction,
        (_event, action: unknown) => {
          listener(action as DesktopMenuEventId)
        },
      ),
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
