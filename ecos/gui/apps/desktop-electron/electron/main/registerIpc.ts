import { BrowserWindow, ipcMain, shell, type IpcMain, type IpcMainInvokeEvent } from 'electron'
import { desktopApiIpcChannels, type TileGenerationRequest, type TileGenerationResult } from '@ecos-studio/shared'
import {
  closeWindow,
  isWindowMaximized,
  minimizeWindow,
  setWindowTitle,
  toggleMaximizeWindow,
} from '../services/windowService'

export type IpcMainLike = Pick<IpcMain, 'handle'>

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

export function registerIpc(target: IpcMainLike = ipcMain): void {
  target.handle(desktopApiIpcChannels.windowMinimize, (event) => {
    minimizeWindow(getEventWindow(event))
  })

  target.handle(desktopApiIpcChannels.windowToggleMaximize, (event) => {
    toggleMaximizeWindow(getEventWindow(event))
  })

  target.handle(desktopApiIpcChannels.windowClose, (event) => {
    closeWindow(getEventWindow(event))
  })

  target.handle(desktopApiIpcChannels.windowSetTitle, (event, title: string) => {
    setWindowTitle(getEventWindow(event), title)
  })

  target.handle(desktopApiIpcChannels.windowIsMaximized, (event) => {
    return isWindowMaximized(getEventWindow(event))
  })

  target.handle(
    desktopApiIpcChannels.tilesGenerate,
    createNotImplementedHandler<TileGenerationResult>('tiles.generate'),
  )

  target.handle(
    desktopApiIpcChannels.workspaceOpen,
    createNotImplementedHandler('workspace.openProject'),
  )

  target.handle(
    desktopApiIpcChannels.workspaceLoadRecent,
    createNotImplementedHandler('workspace.loadRecent'),
  )

  target.handle(desktopApiIpcChannels.systemOpenExternal, async (_event, url: string) => {
    await shell.openExternal(url)
  })
}
