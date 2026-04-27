import { describe, expect, it, vi } from 'vitest'
import { desktopApiIpcChannels } from '@ecos-studio/shared'

vi.mock('electron', () => ({
  BrowserWindow: {
    fromWebContents: vi.fn(),
  },
  ipcMain: {
    handle: vi.fn(),
  },
  shell: {
    openExternal: vi.fn(),
  },
}))

import { registerIpc } from './registerIpc'

describe('registerIpc', () => {
  it('registers a handler for every desktop bridge channel', () => {
    const handle = vi.fn()

    registerIpc({ handle })

    expect(handle.mock.calls).toHaveLength(Object.keys(desktopApiIpcChannels).length)
    expect(
      handle.mock.calls.map(([channel, listener]) => ({
        channel,
        listenerType: typeof listener,
      })),
    ).toEqual([
      { channel: desktopApiIpcChannels.windowMinimize, listenerType: 'function' },
      { channel: desktopApiIpcChannels.windowToggleMaximize, listenerType: 'function' },
      { channel: desktopApiIpcChannels.windowClose, listenerType: 'function' },
      { channel: desktopApiIpcChannels.windowSetTitle, listenerType: 'function' },
      { channel: desktopApiIpcChannels.windowIsMaximized, listenerType: 'function' },
      { channel: desktopApiIpcChannels.workspaceOpen, listenerType: 'function' },
      { channel: desktopApiIpcChannels.workspaceLoadRecent, listenerType: 'function' },
      { channel: desktopApiIpcChannels.tilesGenerate, listenerType: 'function' },
      { channel: desktopApiIpcChannels.systemOpenExternal, listenerType: 'function' },
    ])
  })
})
