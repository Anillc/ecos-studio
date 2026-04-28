import { contextBridge, ipcRenderer } from 'electron'
import {
  desktopApiEventChannels,
  desktopApiIpcChannels,
} from '../../../../packages/shared/src/constants/ipcChannels.ts'
import type {
  DesktopApi,
  DesktopDirectoryDialogOptions,
  DesktopFileDialogOptions,
  DesktopMenuEventId,
  DesktopSettingsValue,
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
  app: {
    getVersions: () => ipcRenderer.invoke(desktopApiIpcChannels.appGetVersions),
  },
  window: {
    minimize: () => ipcRenderer.invoke(desktopApiIpcChannels.windowMinimize),
    toggleMaximize: () => ipcRenderer.invoke(desktopApiIpcChannels.windowToggleMaximize),
    close: () => ipcRenderer.invoke(desktopApiIpcChannels.windowClose),
    confirmClose: () => ipcRenderer.invoke(desktopApiIpcChannels.windowConfirmClose),
    setTitle: (title) => ipcRenderer.invoke(desktopApiIpcChannels.windowSetTitle, title),
    isMaximized: () => ipcRenderer.invoke(desktopApiIpcChannels.windowIsMaximized),
    onCloseRequested: (listener) =>
      subscribeToDesktopEvent(desktopApiEventChannels.windowCloseRequested, () => {
        listener()
      }),
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
  settings: {
    get: <T extends DesktopSettingsValue = DesktopSettingsValue>(key: string) =>
      ipcRenderer.invoke(desktopApiIpcChannels.settingsGet, key) as Promise<T | null>,
    set: (key, value) => ipcRenderer.invoke(desktopApiIpcChannels.settingsSet, key, value),
    delete: (key) => ipcRenderer.invoke(desktopApiIpcChannels.settingsDelete, key),
  },
  dialog: {
    pickDirectory: (options?: DesktopDirectoryDialogOptions) =>
      ipcRenderer.invoke(desktopApiIpcChannels.dialogPickDirectory, options),
    pickFiles: (options?: DesktopFileDialogOptions) =>
      ipcRenderer.invoke(desktopApiIpcChannels.dialogPickFiles, options),
  },
  workspace: {
    getApiPort: () => ipcRenderer.invoke(desktopApiIpcChannels.workspaceGetApiPort),
    isProjectDirectory: (path) =>
      ipcRenderer.invoke(desktopApiIpcChannels.workspaceIsProjectDirectory, path),
    registerProjectRoot: (path) =>
      ipcRenderer.invoke(desktopApiIpcChannels.workspaceRegisterProjectRoot, path),
    clearProjectRoot: () =>
      ipcRenderer.invoke(desktopApiIpcChannels.workspaceClearProjectRoot),
    requestProjectPathAccess: (path) =>
      ipcRenderer.invoke(desktopApiIpcChannels.workspaceRequestProjectPathAccess, path),
    readProjectTextFile: (path) =>
      ipcRenderer.invoke(desktopApiIpcChannels.workspaceReadProjectTextFile, path),
    readProjectBinaryFile: (path) =>
      ipcRenderer.invoke(desktopApiIpcChannels.workspaceReadProjectBinaryFile, path),
    writeProjectTextFile: (path, content) =>
      ipcRenderer.invoke(desktopApiIpcChannels.workspaceWriteProjectTextFile, path, content),
    scanPdkDirectory: (path) =>
      ipcRenderer.invoke(desktopApiIpcChannels.workspaceScanPdkDirectory, path),
  },
  tiles: {
    generate: (request) => ipcRenderer.invoke(desktopApiIpcChannels.tilesGenerate, request),
  },
}

contextBridge.exposeInMainWorld('ecosDesktop', desktopApi)
