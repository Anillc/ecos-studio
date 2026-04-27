import type { WorkspaceSummary } from '../types/workspace'
import type { TileGenerationRequest, TileGenerationResult } from '../types/tile'

export interface DesktopApi {
  window: {
    minimize(): Promise<void>
    toggleMaximize(): Promise<void>
    close(): Promise<void>
    setTitle(title: string): Promise<void>
    isMaximized(): Promise<boolean>
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
