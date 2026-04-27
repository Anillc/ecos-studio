import type { DesktopApi } from '@ecos-studio/shared'

export const DESKTOP_BRIDGE_UNAVAILABLE_MESSAGE = 'ECOS desktop bridge is not available.'

declare global {
  interface Window {
    ecosDesktop?: DesktopApi
  }
}

function getGlobalWindow(): (Window & typeof globalThis) | undefined {
  if (typeof window === 'undefined') {
    return undefined
  }

  return window
}

export function hasDesktopApi(): boolean {
  return getGlobalWindow()?.ecosDesktop != null
}

export function getDesktopApi(): DesktopApi {
  const currentWindow = getGlobalWindow()

  if (!currentWindow?.ecosDesktop) {
    throw new Error(DESKTOP_BRIDGE_UNAVAILABLE_MESSAGE)
  }

  return currentWindow.ecosDesktop
}
