import { desktopApiEventChannels } from '@ecos-studio/shared'

type WindowEventName = 'maximize' | 'resize' | 'unmaximize'
type WindowEventListener = () => void

export interface BrowserWindowLike {
  close(): void
  isMaximized(): boolean
  maximize(): void
  minimize(): void
  on(eventName: WindowEventName, listener: WindowEventListener): unknown
  removeListener(eventName: WindowEventName, listener: WindowEventListener): unknown
  setTitle(title: string): void
  unmaximize(): void
  webContents: {
    send(channel: string, ...args: unknown[]): void
  }
}

export function minimizeWindow(window: BrowserWindowLike): void {
  window.minimize()
}

export function toggleMaximizeWindow(window: BrowserWindowLike): void {
  if (window.isMaximized()) {
    window.unmaximize()
    return
  }

  window.maximize()
}

export function closeWindow(window: BrowserWindowLike): void {
  window.close()
}

export function setWindowTitle(window: BrowserWindowLike, title: string): void {
  window.setTitle(title)
}

export function isWindowMaximized(window: BrowserWindowLike): boolean {
  return window.isMaximized()
}

export function bindWindowEvents(window: BrowserWindowLike): () => void {
  const listeners: Array<[WindowEventName, WindowEventListener]> = [
    [
      'resize',
      () => {
        window.webContents.send(desktopApiEventChannels.windowResized)
      },
    ],
    [
      'maximize',
      () => {
        window.webContents.send(desktopApiEventChannels.windowMaximizedChanged, true)
      },
    ],
    [
      'unmaximize',
      () => {
        window.webContents.send(desktopApiEventChannels.windowMaximizedChanged, false)
      },
    ],
  ]

  for (const [eventName, listener] of listeners) {
    window.on(eventName, listener)
  }

  return () => {
    for (const [eventName, listener] of listeners) {
      window.removeListener(eventName, listener)
    }
  }
}
