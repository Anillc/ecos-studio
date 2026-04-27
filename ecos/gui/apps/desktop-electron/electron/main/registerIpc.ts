import {
  BrowserWindow,
  dialog,
  ipcMain,
  shell,
  type IpcMain,
  type IpcMainInvokeEvent,
} from 'electron'
import {
  desktopApiIpcChannels,
  type DesktopDirectoryDialogOptions,
  type DesktopSettingsValue,
  type ScannedPdkDirectory,
  type TileGenerationRequest,
  type TileGenerationResult,
} from '@ecos-studio/shared'
import {
  closeWindow,
  confirmWindowClose,
  isWindowMaximized,
  minimizeWindow,
  setWindowTitle,
  toggleMaximizeWindow,
} from '../services/windowService'

export type IpcMainLike = Pick<IpcMain, 'handle'>

export interface DesktopBridgeServices {
  settingsStore: {
    delete(key: string): Promise<void>
    get<T extends DesktopSettingsValue = DesktopSettingsValue>(key: string): Promise<T | null>
    set(key: string, value: DesktopSettingsValue): Promise<void>
  }
  workspaceService: {
    clearProjectRoot(): Promise<void>
    getApiPort(): Promise<number>
    isProjectDirectory(path: string): Promise<boolean>
    readProjectTextFile(path: string): Promise<string>
    registerProjectRoot(path: string): Promise<string>
    requestProjectPathAccess(path: string): Promise<string>
    scanPdkDirectory(path: string): Promise<ScannedPdkDirectory>
  }
}

class DesktopApiNotImplementedError extends Error {
  constructor(capabilityName: string) {
    super(`${capabilityName} is not implemented in the Electron shell yet.`)
    this.name = 'DesktopApiNotImplementedError'
  }
}

function getEventWindow(event: IpcMainInvokeEvent): BrowserWindow {
  const targetWindow = BrowserWindow.fromWebContents(event.sender)

  if (!targetWindow) {
    throw new Error('Unable to resolve the Electron window for this IPC request.')
  }

  return targetWindow
}

function notImplemented(capabilityName: string): never {
  throw new DesktopApiNotImplementedError(capabilityName)
}

function createNotImplementedHandler<TResult>(
  capabilityName: string,
): (_event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<TResult> {
  return async () => notImplemented(capabilityName)
}

async function pickDirectory(
  options?: DesktopDirectoryDialogOptions,
): Promise<string | null> {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: options?.title,
  })

  if (result.canceled) {
    return null
  }

  return result.filePaths[0] ?? null
}

export function registerIpc(
  target: IpcMainLike = ipcMain,
  services: DesktopBridgeServices,
): void {
  target.handle(desktopApiIpcChannels.windowMinimize, (event) => {
    minimizeWindow(getEventWindow(event))
  })

  target.handle(desktopApiIpcChannels.windowToggleMaximize, (event) => {
    toggleMaximizeWindow(getEventWindow(event))
  })

  target.handle(desktopApiIpcChannels.windowClose, (event) => {
    closeWindow(getEventWindow(event))
  })

  target.handle(desktopApiIpcChannels.windowConfirmClose, (event) => {
    confirmWindowClose(getEventWindow(event))
  })

  target.handle(desktopApiIpcChannels.windowSetTitle, (event, title: string) => {
    setWindowTitle(getEventWindow(event), title)
  })

  target.handle(desktopApiIpcChannels.windowIsMaximized, (event) => {
    return isWindowMaximized(getEventWindow(event))
  })

  target.handle(desktopApiIpcChannels.settingsGet, async (_event, key: string) => {
    return await services.settingsStore.get(key)
  })

  target.handle(
    desktopApiIpcChannels.settingsSet,
    async (_event, key: string, value: DesktopSettingsValue) => {
      await services.settingsStore.set(key, value)
    },
  )

  target.handle(desktopApiIpcChannels.settingsDelete, async (_event, key: string) => {
    await services.settingsStore.delete(key)
  })

  target.handle(
    desktopApiIpcChannels.dialogPickDirectory,
    async (_event, options?: DesktopDirectoryDialogOptions) => {
      return await pickDirectory(options)
    },
  )

  target.handle(desktopApiIpcChannels.workspaceGetApiPort, async () => {
    return await services.workspaceService.getApiPort()
  })

  target.handle(
    desktopApiIpcChannels.workspaceIsProjectDirectory,
    async (_event, path: string) => {
      return await services.workspaceService.isProjectDirectory(path)
    },
  )

  target.handle(
    desktopApiIpcChannels.workspaceRegisterProjectRoot,
    async (_event, path: string) => {
      return await services.workspaceService.registerProjectRoot(path)
    },
  )

  target.handle(
    desktopApiIpcChannels.workspaceClearProjectRoot,
    async () => {
      await services.workspaceService.clearProjectRoot()
    },
  )

  target.handle(
    desktopApiIpcChannels.workspaceRequestProjectPathAccess,
    async (_event, path: string) => {
      return await services.workspaceService.requestProjectPathAccess(path)
    },
  )

  target.handle(
    desktopApiIpcChannels.workspaceReadProjectTextFile,
    async (_event, path: string) => {
      return await services.workspaceService.readProjectTextFile(path)
    },
  )

  target.handle(
    desktopApiIpcChannels.workspaceScanPdkDirectory,
    async (_event, path: string) => {
      return await services.workspaceService.scanPdkDirectory(path)
    },
  )

  target.handle(
    desktopApiIpcChannels.tilesGenerate,
    createNotImplementedHandler<TileGenerationResult>('tiles.generate'),
  )

  target.handle(desktopApiIpcChannels.systemOpenExternal, async (_event, url: string) => {
    await shell.openExternal(url)
  })
}
