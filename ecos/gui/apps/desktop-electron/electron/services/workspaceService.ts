import { readFile } from 'node:fs/promises'
import type { ScannedPdkDirectory } from '@ecos-studio/shared'

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

  async scanPdkDirectory(path: string): Promise<ScannedPdkDirectory> {
    return await this.projectScopeProvider.scanPdkDirectory(path)
  }
}
