import { beforeEach, describe, expect, it, vi } from 'vitest'
import { desktopApiEventChannels } from '@ecos-studio/shared'
import { bindWindowEvents, toggleMaximizeWindow } from './windowService'

type WindowListener = () => void

function createWindowDouble(isMaximized = false) {
  const listeners = new Map<string, WindowListener>()

  return {
    close: vi.fn(),
    isMaximized: vi.fn(() => isMaximized),
    listeners,
    maximize: vi.fn(),
    minimize: vi.fn(),
    on: vi.fn((event: string, listener: WindowListener) => {
      listeners.set(event, listener)
    }),
    removeListener: vi.fn((event: string, listener: WindowListener) => {
      if (listeners.get(event) === listener) {
        listeners.delete(event)
      }
    }),
    setTitle: vi.fn(),
    unmaximize: vi.fn(),
    webContents: {
      send: vi.fn(),
    },
  }
}

describe('windowService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('toggles maximize by maximizing a normal window and restoring a maximized one', () => {
    const normalWindow = createWindowDouble(false)
    toggleMaximizeWindow(normalWindow)

    expect(normalWindow.maximize).toHaveBeenCalledTimes(1)
    expect(normalWindow.unmaximize).not.toHaveBeenCalled()

    const maximizedWindow = createWindowDouble(true)
    toggleMaximizeWindow(maximizedWindow)

    expect(maximizedWindow.unmaximize).toHaveBeenCalledTimes(1)
    expect(maximizedWindow.maximize).not.toHaveBeenCalled()
  })

  it('bridges resize and maximize state changes to renderer event channels', () => {
    const windowDouble = createWindowDouble(false)
    const dispose = bindWindowEvents(windowDouble)

    windowDouble.listeners.get('resize')?.()
    windowDouble.listeners.get('maximize')?.()
    windowDouble.listeners.get('unmaximize')?.()

    expect(windowDouble.webContents.send).toHaveBeenNthCalledWith(
      1,
      desktopApiEventChannels.windowResized,
    )
    expect(windowDouble.webContents.send).toHaveBeenNthCalledWith(
      2,
      desktopApiEventChannels.windowMaximizedChanged,
      true,
    )
    expect(windowDouble.webContents.send).toHaveBeenNthCalledWith(
      3,
      desktopApiEventChannels.windowMaximizedChanged,
      false,
    )

    dispose()

    expect(windowDouble.removeListener).toHaveBeenCalledTimes(3)
    expect(windowDouble.listeners.size).toBe(0)
  })
})
