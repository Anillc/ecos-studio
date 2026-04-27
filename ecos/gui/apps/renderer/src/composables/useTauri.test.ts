import { afterEach, describe, expect, it } from 'vitest'
import { isTauri, useTauri } from './useTauri'

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')

function setWindow(value: unknown) {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value,
    writable: true,
  })
}

function restoreWindow() {
  if (originalWindow) {
    Object.defineProperty(globalThis, 'window', originalWindow)
    return
  }

  delete (globalThis as { window?: unknown }).window
}

const desktopBridge = {
  window: {
    minimize: async () => undefined,
    toggleMaximize: async () => undefined,
    close: async () => undefined,
    setTitle: async (_title: string) => undefined,
    isMaximized: async () => false,
  },
  system: {
    openExternal: async (_url: string) => undefined,
  },
  workspace: {
    loadRecent: async () => [],
    openProject: async () => null,
  },
  tiles: {
    generate: async () => ({ baseUrl: '', outDir: '', fromCache: false }),
  },
}

describe('useTauri desktop bridge guard', () => {
  afterEach(() => {
    restoreWindow()
  })

  it('treats the injected desktop bridge as a desktop runtime', () => {
    setWindow({ ecosDesktop: desktopBridge })

    expect(isTauri()).toBe(true)
    expect(useTauri().isInTauri).toBe(true)
  })

  it('allows guarded features when the desktop bridge is present', () => {
    setWindow({ ecosDesktop: desktopBridge })

    expect(() => useTauri().ensureTauri(false)).not.toThrow()
  })
})
