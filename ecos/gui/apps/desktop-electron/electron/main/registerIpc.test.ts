import { beforeEach, describe, expect, it, vi } from 'vitest'
import { desktopApiIpcChannels } from '@ecos-studio/shared'

const { fromWebContents, openExternal, showOpenDialog } = vi.hoisted(() => ({
  fromWebContents: vi.fn(),
  openExternal: vi.fn(),
  showOpenDialog: vi.fn(),
}))

vi.mock('electron', () => ({
  BrowserWindow: {
    fromWebContents,
  },
  dialog: {
    showOpenDialog,
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
  const services = {
    settingsStore: {
      delete: vi.fn(),
      get: vi.fn(),
      set: vi.fn(),
    },
    workspaceService: {
      clearProjectRoot: vi.fn(),
      getApiPort: vi.fn(),
      isProjectDirectory: vi.fn(),
      registerProjectRoot: vi.fn(),
      requestProjectPathAccess: vi.fn(),
      scanPdkDirectory: vi.fn(),
    },
  }

  registerIpc({
    handle: (channel, listener) => {
      handlers.set(channel, listener as RegisteredHandler)
    },
  }, services)

  return {
    handlers,
    services,
  }
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
    showOpenDialog.mockReset()
  })

  it('registers a handler for every desktop bridge channel', () => {
    const { handlers } = registerHandlers()

    expect(Array.from(handlers.keys()).sort()).toEqual([
      desktopApiIpcChannels.windowMinimize,
      desktopApiIpcChannels.windowToggleMaximize,
      desktopApiIpcChannels.windowClose,
      desktopApiIpcChannels.windowConfirmClose,
      desktopApiIpcChannels.windowSetTitle,
      desktopApiIpcChannels.windowIsMaximized,
      desktopApiIpcChannels.settingsGet,
      desktopApiIpcChannels.settingsSet,
      desktopApiIpcChannels.settingsDelete,
      desktopApiIpcChannels.dialogPickDirectory,
      desktopApiIpcChannels.workspaceGetApiPort,
      desktopApiIpcChannels.workspaceIsProjectDirectory,
      desktopApiIpcChannels.workspaceRegisterProjectRoot,
      desktopApiIpcChannels.workspaceClearProjectRoot,
      desktopApiIpcChannels.workspaceRequestProjectPathAccess,
      desktopApiIpcChannels.workspaceScanPdkDirectory,
      desktopApiIpcChannels.tilesGenerate,
      desktopApiIpcChannels.systemOpenExternal,
    ].sort())
  })

  it('looks up the event window and uses it for window controls', async () => {
    const { handlers } = registerHandlers()
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
    const { handlers } = registerHandlers()
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
    const { handlers } = registerHandlers()

    await handlers.get(desktopApiIpcChannels.systemOpenExternal)?.(
      { sender: { id: 'web-contents' } },
      'https://openecos.org',
    )

    expect(openExternal).toHaveBeenCalledWith('https://openecos.org')
  })

  it('delegates settings, dialog, and workspace calls to the provided services', async () => {
    const { handlers, services } = registerHandlers()
    const event = { sender: { id: 'web-contents' } }
    services.settingsStore.get.mockResolvedValue([{ id: 'recent' }])
    services.workspaceService.getApiPort.mockResolvedValue(9123)
    services.workspaceService.isProjectDirectory.mockResolvedValue(true)
    services.workspaceService.registerProjectRoot.mockResolvedValue('/tmp/project')
    services.workspaceService.requestProjectPathAccess.mockResolvedValue('/tmp/project/home.json')
    services.workspaceService.scanPdkDirectory.mockResolvedValue({
      canonicalPath: '/tmp/pdk',
      name: 'ics55',
      description: 'ICSPROUT 55nm process library (auto-detected)',
      techNode: '55nm',
      pdkId: 'ics55',
      detectedFiles: {
        directories: ['IP', 'prtech'],
        files: [],
      },
    })
    showOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: ['/tmp/project'],
    })

    await expect(handlers.get(desktopApiIpcChannels.settingsGet)?.(event, 'recent_projects')).resolves.toEqual([
      { id: 'recent' },
    ])
    await handlers.get(desktopApiIpcChannels.settingsSet)?.(event, 'recent_projects', [
      { id: 'recent' },
    ])
    await handlers.get(desktopApiIpcChannels.settingsDelete)?.(event, 'recent_projects')
    await expect(
      handlers.get(desktopApiIpcChannels.dialogPickDirectory)?.(event, {
        title: 'Select Project',
      }),
    ).resolves.toBe('/tmp/project')
    await expect(handlers.get(desktopApiIpcChannels.workspaceGetApiPort)?.(event)).resolves.toBe(
      9123,
    )
    await expect(
      handlers.get(desktopApiIpcChannels.workspaceIsProjectDirectory)?.(event, '/tmp/project'),
    ).resolves.toBe(true)
    await expect(
      handlers.get(desktopApiIpcChannels.workspaceRegisterProjectRoot)?.(event, '/tmp/project'),
    ).resolves.toBe('/tmp/project')
    await handlers.get(desktopApiIpcChannels.workspaceClearProjectRoot)?.(event)
    await expect(
      handlers.get(desktopApiIpcChannels.workspaceRequestProjectPathAccess)?.(
        event,
        '/tmp/project/home.json',
      ),
    ).resolves.toBe('/tmp/project/home.json')
    await expect(
      handlers.get(desktopApiIpcChannels.workspaceScanPdkDirectory)?.(event, '/tmp/pdk'),
    ).resolves.toMatchObject({
      canonicalPath: '/tmp/pdk',
      pdkId: 'ics55',
    })

    expect(services.settingsStore.get).toHaveBeenCalledWith('recent_projects')
    expect(services.settingsStore.set).toHaveBeenCalledWith('recent_projects', [{ id: 'recent' }])
    expect(services.settingsStore.delete).toHaveBeenCalledWith('recent_projects')
    expect(showOpenDialog).toHaveBeenCalledWith({
      properties: ['openDirectory'],
      title: 'Select Project',
    })
    expect(services.workspaceService.clearProjectRoot).toHaveBeenCalledTimes(1)
  })

  it('rejects unfinished tile handlers explicitly', async () => {
    const { handlers } = registerHandlers()
    const event = { sender: { id: 'web-contents' } }

    await expect(
      handlers.get(desktopApiIpcChannels.tilesGenerate)?.(event, { layoutPath: 'layout.json' }),
    ).rejects.toMatchObject({
      name: 'DesktopApiNotImplementedError',
      message: 'tiles.generate is not implemented in the Electron shell yet.',
    })
  })
})
