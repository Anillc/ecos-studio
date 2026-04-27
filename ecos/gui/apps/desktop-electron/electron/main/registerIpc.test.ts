import { beforeEach, describe, expect, it, vi } from 'vitest'
import { desktopApiIpcChannels } from '@ecos-studio/shared'

const { fromWebContents, openExternal } = vi.hoisted(() => ({
  fromWebContents: vi.fn(),
  openExternal: vi.fn(),
}))

vi.mock('electron', () => ({
  BrowserWindow: {
    fromWebContents,
  },
  ipcMain: {
    handle: vi.fn(),
  },
  shell: {
    openExternal,
  },
}))

import { registerIpc } from './registerIpc'

type RegisteredHandler = (event: { sender: unknown }, ...args: unknown[]) => unknown

function registerHandlers() {
  const handlers = new Map<string, RegisteredHandler>()

  registerIpc({
    handle: (channel, listener) => {
      handlers.set(channel, listener as RegisteredHandler)
    },
  })

  return handlers
}

function createWindowDouble(isMaximized = false) {
  return {
    close: vi.fn(),
    isMaximized: vi.fn(() => isMaximized),
    maximize: vi.fn(),
    minimize: vi.fn(),
    setTitle: vi.fn(),
    unmaximize: vi.fn(),
  }
}

describe('registerIpc', () => {
  beforeEach(() => {
    fromWebContents.mockReset()
    openExternal.mockReset()
  })

  it('registers a handler for every desktop bridge channel', () => {
    const handlers = registerHandlers()

    expect(Array.from(handlers.keys()).sort()).toEqual([
      desktopApiIpcChannels.windowMinimize,
      desktopApiIpcChannels.windowToggleMaximize,
      desktopApiIpcChannels.windowClose,
      desktopApiIpcChannels.windowConfirmClose,
      desktopApiIpcChannels.windowSetTitle,
      desktopApiIpcChannels.windowIsMaximized,
      desktopApiIpcChannels.workspaceOpen,
      desktopApiIpcChannels.workspaceLoadRecent,
      desktopApiIpcChannels.tilesGenerate,
      desktopApiIpcChannels.systemOpenExternal,
    ].sort())
  })

  it('looks up the event window and uses it for window controls', async () => {
    const handlers = registerHandlers()
    const event = { sender: { id: 'web-contents' } }
    const windowDouble = createWindowDouble(false)
    fromWebContents.mockReturnValue(windowDouble)

    await handlers.get(desktopApiIpcChannels.windowMinimize)?.(event)
    await handlers.get(desktopApiIpcChannels.windowSetTitle)?.(event, 'ECOS Studio')
    const isMaximized = await handlers.get(desktopApiIpcChannels.windowIsMaximized)?.(event)
    await handlers.get(desktopApiIpcChannels.windowClose)?.(event)
    await handlers.get(desktopApiIpcChannels.windowConfirmClose)?.(event)

    expect(fromWebContents).toHaveBeenCalledTimes(5)
    expect(fromWebContents).toHaveBeenNthCalledWith(1, event.sender)
    expect(windowDouble.minimize).toHaveBeenCalledTimes(1)
    expect(windowDouble.setTitle).toHaveBeenCalledWith('ECOS Studio')
    expect(isMaximized).toBe(false)
    expect(windowDouble.close).toHaveBeenCalledTimes(2)
  })

  it('toggles maximize by maximizing a normal window and restoring a maximized one', async () => {
    const handlers = registerHandlers()
    const toggleHandler = handlers.get(desktopApiIpcChannels.windowToggleMaximize)
    const event = { sender: { id: 'web-contents' } }

    const normalWindow = createWindowDouble(false)
    fromWebContents.mockReturnValueOnce(normalWindow)
    await toggleHandler?.(event)

    expect(normalWindow.maximize).toHaveBeenCalledTimes(1)
    expect(normalWindow.unmaximize).not.toHaveBeenCalled()

    const maximizedWindow = createWindowDouble(true)
    fromWebContents.mockReturnValueOnce(maximizedWindow)
    await toggleHandler?.(event)

    expect(maximizedWindow.unmaximize).toHaveBeenCalledTimes(1)
    expect(maximizedWindow.maximize).not.toHaveBeenCalled()
  })

  it('opens external URLs through the Electron shell', async () => {
    const handlers = registerHandlers()

    await handlers.get(desktopApiIpcChannels.systemOpenExternal)?.(
      { sender: { id: 'web-contents' } },
      'https://openecos.org',
    )

    expect(openExternal).toHaveBeenCalledWith('https://openecos.org')
  })

  it('rejects unfinished workspace and tile handlers explicitly', async () => {
    const handlers = registerHandlers()
    const event = { sender: { id: 'web-contents' } }

    await expect(handlers.get(desktopApiIpcChannels.workspaceOpen)?.(event)).rejects.toMatchObject({
      name: 'DesktopApiNotImplementedError',
      message: 'workspace.openProject is not implemented in the Electron shell yet.',
    })
    await expect(
      handlers.get(desktopApiIpcChannels.workspaceLoadRecent)?.(event),
    ).rejects.toMatchObject({
      name: 'DesktopApiNotImplementedError',
      message: 'workspace.loadRecent is not implemented in the Electron shell yet.',
    })
    await expect(
      handlers.get(desktopApiIpcChannels.tilesGenerate)?.(event, { layoutPath: 'layout.json' }),
    ).rejects.toMatchObject({
      name: 'DesktopApiNotImplementedError',
      message: 'tiles.generate is not implemented in the Electron shell yet.',
    })
  })
})
