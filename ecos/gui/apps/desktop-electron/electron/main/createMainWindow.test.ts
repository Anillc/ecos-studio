import { beforeEach, describe, expect, it, vi } from 'vitest'

const { browserWindowConstructor, browserWindowState } = vi.hoisted(() => {
  const state: {
    currentReturnValue: unknown
  } = {
    currentReturnValue: undefined,
  }

  const constructor = vi.fn(function BrowserWindowMock() {
    return state.currentReturnValue
  })

  return {
    browserWindowConstructor: constructor,
    browserWindowState: state,
  }
})

vi.mock('electron', () => ({
  BrowserWindow: browserWindowConstructor,
}))

describe('createMainWindow', () => {
  beforeEach(() => {
    browserWindowConstructor.mockReset()
    browserWindowState.currentReturnValue = undefined
  })

  it('creates a frameless transparent window so renderer border radius can cut the native corners', async () => {
    const windowDouble = {
      loadFile: vi.fn().mockResolvedValue(undefined),
      loadURL: vi.fn().mockResolvedValue(undefined),
      webContents: {
        on: vi.fn(),
      },
    }
    browserWindowState.currentReturnValue = windowDouble

    const { createMainWindow } = await import('./createMainWindow')

    await createMainWindow()

    expect(browserWindowConstructor).toHaveBeenCalledTimes(1)
    expect(browserWindowConstructor).toHaveBeenCalledWith(expect.objectContaining({
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
    }))
  })
})
