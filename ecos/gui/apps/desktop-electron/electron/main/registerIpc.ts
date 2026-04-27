import { BrowserWindow, ipcMain, shell, type IpcMain, type IpcMainInvokeEvent } from 'electron'
import {
  desktopApiIpcChannels,
  type TileGenerationRequest,
  type TileGenerationResult,
  type WorkspaceSummary,
} from '@ecos-studio/shared'

export type IpcMainLike = Pick<IpcMain, 'handle'>

function getEventWindow(event: IpcMainInvokeEvent): BrowserWindow {
  const targetWindow = BrowserWindow.fromWebContents(event.sender)

  if (!targetWindow) {
    throw new Error('Unable to resolve the Electron window for this IPC request.')
  }

  return targetWindow
}

function notImplemented(featureName: string): never {
  throw new Error(`${featureName} is not implemented in the Electron shell yet.`)
}

export function registerIpc(target: IpcMainLike = ipcMain): void {
  target.handle(desktopApiIpcChannels.windowMinimize, (event) => {
    getEventWindow(event).minimize()
  })

  target.handle(desktopApiIpcChannels.windowToggleMaximize, (event) => {
    const targetWindow = getEventWindow(event)

    if (targetWindow.isMaximized()) {
      targetWindow.unmaximize()
      return
    }

    targetWindow.maximize()
  })

  target.handle(desktopApiIpcChannels.windowClose, (event) => {
    getEventWindow(event).close()
  })

  target.handle(desktopApiIpcChannels.windowSetTitle, (event, title: string) => {
    getEventWindow(event).setTitle(title)
  })

  target.handle(desktopApiIpcChannels.windowIsMaximized, (event) => {
    return getEventWindow(event).isMaximized()
  })

  target.handle(
    desktopApiIpcChannels.workspaceOpen,
    async (): Promise<WorkspaceSummary | null> => null,
  )

  target.handle(
    desktopApiIpcChannels.workspaceLoadRecent,
    async (): Promise<WorkspaceSummary[]> => [],
  )

  target.handle(
    desktopApiIpcChannels.tilesGenerate,
    async (_event, _request: TileGenerationRequest): Promise<TileGenerationResult> =>
      notImplemented('Tile generation'),
  )

  target.handle(desktopApiIpcChannels.systemOpenExternal, async (_event, url: string) => {
    await shell.openExternal(url)
  })
}
