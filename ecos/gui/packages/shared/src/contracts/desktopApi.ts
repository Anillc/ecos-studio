import type { TileGenerationRequest, TileGenerationResult } from '../types/tile'
import type { DesktopEventUnsubscribe, DesktopMenuEventId } from './desktopEvents'

export type DesktopSettingsValue =
  | string
  | number
  | boolean
  | null
  | DesktopSettingsValue[]
  | {
      [key: string]: DesktopSettingsValue
    }

export interface DesktopDirectoryDialogOptions {
  title?: string
}

export interface PdkDetectedFiles {
  directories: string[]
  files: string[]
}

export interface ScannedPdkDirectory {
  canonicalPath: string
  name: string
  description: string
  techNode: string
  pdkId: string
  detectedFiles: PdkDetectedFiles
}

export interface DesktopApi {
  window: {
    minimize(): Promise<void>
    toggleMaximize(): Promise<void>
    close(): Promise<void>
    confirmClose(): Promise<void>
    setTitle(title: string): Promise<void>
    isMaximized(): Promise<boolean>
    onCloseRequested(listener: () => void): DesktopEventUnsubscribe
    onResized(listener: () => void): DesktopEventUnsubscribe
    onMaximizedChanged(listener: (isMaximized: boolean) => void): DesktopEventUnsubscribe
  }
  menu: {
    onAction(listener: (eventId: DesktopMenuEventId) => void): DesktopEventUnsubscribe
  }
  system: {
    openExternal(url: string): Promise<void>
  }
  settings: {
    get<T extends DesktopSettingsValue = DesktopSettingsValue>(key: string): Promise<T | null>
    set(key: string, value: DesktopSettingsValue): Promise<void>
    delete(key: string): Promise<void>
  }
  dialog: {
    pickDirectory(options?: DesktopDirectoryDialogOptions): Promise<string | null>
  }
  workspace: {
    getApiPort(): Promise<number>
    isProjectDirectory(path: string): Promise<boolean>
    registerProjectRoot(path: string): Promise<string>
    clearProjectRoot(): Promise<void>
    requestProjectPathAccess(path: string): Promise<string>
    scanPdkDirectory(path: string): Promise<ScannedPdkDirectory>
  }
  tiles: {
    generate(request: TileGenerationRequest): Promise<TileGenerationResult>
  }
}
