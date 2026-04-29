import {
  BrowserWindow,
  dialog,
  ipcMain,
  shell,
  type IpcMain,
  type IpcMainInvokeEvent,
} from 'electron'
import {
  desktopApiEventChannels,
  desktopApiIpcChannels,
  type DesktopProjectFileChangedEvent,
  type DesktopDirectoryDialogOptions,
  type DesktopFileDialogOptions,
  type DesktopSettingsValue,
  type ScannedPdkDirectory,
  type TileGenerationRequest,
  type TileGenerationResult,
  type VersionInfo,
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
  appInfoService: {
    getVersions(): Promise<VersionInfo>
  }
  settingsStore: {
    delete(key: string): Promise<void>
    get<T extends DesktopSettingsValue = DesktopSettingsValue>(key: string): Promise<T | null>
    set(key: string, value: DesktopSettingsValue): Promise<void>
  }
  workspaceService: {
    clearProjectRoot(): Promise<void>
    getApiPort(): Promise<number>
    isProjectDirectory(path: string): Promise<boolean>
    readProjectBinaryFile(path: string): Promise<Uint8Array>
    readProjectTextFile(path: string): Promise<string>
    registerProjectRoot(path: string): Promise<string>
    requestProjectPathAccess(path: string): Promise<string>
    scanPdkDirectory(path: string): Promise<ScannedPdkDirectory>
    unwatchProjectFile(subscriptionId: string): Promise<void>
    watchProjectFile(
      path: string,
      listener: (event: DesktopProjectFileChangedEvent) => void,
    ): Promise<string>
    writeProjectTextFile(path: string, content: string): Promise<void>
  }
  tileService: {
    generate(request: TileGenerationRequest): Promise<TileGenerationResult>
  }
}

function getEventWindow(event: IpcMainInvokeEvent): BrowserWindow {
  const targetWindow = BrowserWindow.fromWebContents(event.sender)

  if (!targetWindow) {
    throw new Error('Unable to resolve the Electron window for this IPC request.')
  }

  return targetWindow
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

async function pickFiles(
  options?: DesktopFileDialogOptions,
): Promise<string[] | null> {
  const result = await dialog.showOpenDialog({
    properties: options?.multiple ? ['openFile', 'multiSelections'] : ['openFile'],
    title: options?.title,
    filters: options?.filters,
  })

  if (result.canceled || result.filePaths.length === 0) {
    return null
  }

  return result.filePaths
}

export function registerIpc(
  target: IpcMainLike = ipcMain,
  services: DesktopBridgeServices,
): void {
  const projectFileWatchSubscriptions = new Map<
    string,
    {
      sender: IpcMainInvokeEvent['sender']
      onDestroyed: () => void
    }
  >()

  const unwatchProjectFile = async (subscriptionId: string): Promise<void> => {
    const subscription = projectFileWatchSubscriptions.get(subscriptionId)

    if (!subscription) {
      return
    }

    projectFileWatchSubscriptions.delete(subscriptionId)
    subscription.sender.off('destroyed', subscription.onDestroyed)
    await services.workspaceService.unwatchProjectFile(subscriptionId)
  }

  target.handle(desktopApiIpcChannels.appGetVersions, async () => {
    return await services.appInfoService.getVersions()
  })

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

  target.handle(
    desktopApiIpcChannels.dialogPickFiles,
    async (_event, options?: DesktopFileDialogOptions) => {
      return await pickFiles(options)
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
    desktopApiIpcChannels.workspaceReadProjectBinaryFile,
    async (_event, path: string) => {
      return await services.workspaceService.readProjectBinaryFile(path)
    },
  )

  target.handle(
    desktopApiIpcChannels.workspaceWriteProjectTextFile,
    async (_event, path: string, content: string) => {
      await services.workspaceService.writeProjectTextFile(path, content)
    },
  )

  target.handle(
    desktopApiIpcChannels.workspaceScanPdkDirectory,
    async (_event, path: string) => {
      return await services.workspaceService.scanPdkDirectory(path)
    },
  )

  target.handle(
    desktopApiIpcChannels.workspaceWatchProjectFile,
    async (event, path: string) => {
      const sender = event.sender
      let subscriptionId: string | null = null
      const onDestroyed = (): void => {
        if (!subscriptionId) return
        void unwatchProjectFile(subscriptionId)
      }

      subscriptionId = await services.workspaceService.watchProjectFile(path, (payload) => {
        if (event.sender.isDestroyed()) return
        event.sender.send(desktopApiEventChannels.workspaceFileChanged, payload)
      })
      projectFileWatchSubscriptions.set(subscriptionId, {
        sender,
        onDestroyed,
      })
      sender.once('destroyed', onDestroyed)

      if (sender.isDestroyed()) {
        onDestroyed()
      }

      return subscriptionId
    },
  )

  target.handle(
    desktopApiIpcChannels.workspaceUnwatchProjectFile,
    async (_event, subscriptionId: string) => {
      await unwatchProjectFile(subscriptionId)
    },
  )

  target.handle(
    desktopApiIpcChannels.tilesGenerate,
    async (_event, request: TileGenerationRequest) => {
      return await services.tileService.generate(request)
    },
  )

  target.handle(desktopApiIpcChannels.systemOpenExternal, async (_event, url: string) => {
    await shell.openExternal(url)
  })
}
