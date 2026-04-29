import { watch, type FSWatcher } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import type {
  DesktopProjectFileChangedEvent,
  DesktopProjectFileChangeEventType,
  ScannedPdkDirectory,
} from '@ecos-studio/shared'

export interface ApiPortProvider {
  getPort(): Promise<number>
}

export interface ProjectScopeProvider {
  clearProjectRoot(): Promise<void>
  isProjectDirectory(path: string): Promise<boolean>
  requestProjectPathAccess(path: string): Promise<string>
  registerProjectRoot(path: string): Promise<string>
  scanPdkDirectory(path: string): Promise<ScannedPdkDirectory>
}

export interface WorkspaceServiceOptions {
  apiPortProvider: ApiPortProvider
  projectScopeProvider: ProjectScopeProvider
}

export class WorkspaceService {
  private readonly apiPortProvider: ApiPortProvider
  private readonly projectScopeProvider: ProjectScopeProvider
  private readonly projectFileWatchers = new Map<string, { close: () => void; watcher: FSWatcher }>()
  private nextProjectFileWatchId = 1

  constructor(options: WorkspaceServiceOptions) {
    this.apiPortProvider = options.apiPortProvider
    this.projectScopeProvider = options.projectScopeProvider
  }

  async getApiPort(): Promise<number> {
    return await this.apiPortProvider.getPort()
  }

  async isProjectDirectory(path: string): Promise<boolean> {
    return await this.projectScopeProvider.isProjectDirectory(path)
  }

  async registerProjectRoot(path: string): Promise<string> {
    return await this.projectScopeProvider.registerProjectRoot(path)
  }

  async clearProjectRoot(): Promise<void> {
    this.closeAllProjectFileWatchers()
    await this.projectScopeProvider.clearProjectRoot()
  }

  async requestProjectPathAccess(path: string): Promise<string> {
    return await this.projectScopeProvider.requestProjectPathAccess(path)
  }

  async readProjectTextFile(path: string): Promise<string> {
    const canonicalPath = await this.projectScopeProvider.requestProjectPathAccess(path)
    return await readFile(canonicalPath, 'utf8')
  }

  async readProjectBinaryFile(path: string): Promise<Uint8Array> {
    const canonicalPath = await this.projectScopeProvider.requestProjectPathAccess(path)
    return new Uint8Array(await readFile(canonicalPath))
  }

  async writeProjectTextFile(path: string, content: string): Promise<void> {
    const canonicalPath = await this.projectScopeProvider.requestProjectPathAccess(path)
    await writeFile(canonicalPath, content, 'utf8')
  }

  async watchProjectFile(
    path: string,
    listener: (event: DesktopProjectFileChangedEvent) => void,
  ): Promise<string> {
    const canonicalPath = await this.projectScopeProvider.requestProjectPathAccess(path)
    const subscriptionId = `project-file-watch-${this.nextProjectFileWatchId++}`
    let closed = false

    const emit = (eventType: DesktopProjectFileChangeEventType) => {
      if (closed) return
      listener({
        subscriptionId,
        path: canonicalPath,
        eventType,
      })
    }

    const watcher = watch(canonicalPath, { persistent: false }, (eventType) => {
      emit(eventType === 'rename' ? 'rename' : 'change')
    })
    watcher.on('error', () => {
      emit('error')
    })

    this.projectFileWatchers.set(subscriptionId, {
      watcher,
      close: () => {
        closed = true
        watcher.close()
      },
    })
    return subscriptionId
  }

  async unwatchProjectFile(subscriptionId: string): Promise<void> {
    const record = this.projectFileWatchers.get(subscriptionId)
    if (!record) return
    record.close()
    this.projectFileWatchers.delete(subscriptionId)
  }

  async scanPdkDirectory(path: string): Promise<ScannedPdkDirectory> {
    return await this.projectScopeProvider.scanPdkDirectory(path)
  }

  private closeAllProjectFileWatchers(): void {
    for (const record of this.projectFileWatchers.values()) {
      record.close()
    }
    this.projectFileWatchers.clear()
  }
}
