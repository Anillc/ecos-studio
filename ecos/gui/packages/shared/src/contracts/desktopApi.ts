import type { WorkspaceSummary } from '../types/workspace'
import type { TileGenerationRequest, TileGenerationResult } from '../types/tile'
import type { DesktopEventUnsubscribe, DesktopMenuEventId } from './desktopEvents'

export interface DesktopApi {
  window: {
    minimize(): Promise<void>
    toggleMaximize(): Promise<void>
    close(): Promise<void>
    setTitle(title: string): Promise<void>
    isMaximized(): Promise<boolean>
    onResized(listener: () => void): DesktopEventUnsubscribe
    onMaximizedChanged(listener: (isMaximized: boolean) => void): DesktopEventUnsubscribe
  }
  menu: {
    onAction(listener: (eventId: DesktopMenuEventId) => void): DesktopEventUnsubscribe
  }
  system: {
    openExternal(url: string): Promise<void>
  }
  workspace: {
    loadRecent(): Promise<WorkspaceSummary[]>
    openProject(): Promise<WorkspaceSummary | null>
  }
  tiles: {
    generate(request: TileGenerationRequest): Promise<TileGenerationResult>
  }
}
