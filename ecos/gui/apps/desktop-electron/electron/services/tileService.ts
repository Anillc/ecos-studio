import { isAbsolute, join, normalize } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { TileGenerationRequest, TileGenerationResult } from '@ecos-studio/shared'
import {
  finalizeLayoutTileCacheMeta,
  generateLayoutTiles,
  prepareLayoutTileCache,
} from '@ecos-studio/tile-helper'

export interface TileProjectRootProvider {
  getProjectRoot(): Promise<string>
}

export interface TileServiceOptions {
  projectRootProvider: TileProjectRootProvider
}

export function resolveLayoutJsonAbsolutePath(
  projectPath: string,
  layoutJsonRelative: string,
): string {
  const trimmed = layoutJsonRelative.trim()
  if (!trimmed) {
    throw new Error('布局 JSON 路径为空')
  }

  if (isAbsolute(trimmed)) {
    return normalize(trimmed)
  }

  if (trimmed.startsWith('home/') || trimmed.startsWith('Users/')) {
    return normalize(`/${trimmed}`)
  }

  return join(projectPath, trimmed)
}

export class TileService {
  private readonly projectRootProvider: TileProjectRootProvider

  constructor(options: TileServiceOptions) {
    this.projectRootProvider = options.projectRootProvider
  }

  async generate(request: TileGenerationRequest): Promise<TileGenerationResult> {
    const projectRoot = await this.projectRootProvider.getProjectRoot()
    const layoutJsonPath = resolveLayoutJsonAbsolutePath(
      request.projectPath,
      request.layoutJsonRelative,
    )
    const prep = await prepareLayoutTileCache({
      projectPath: request.projectPath,
      projectRoot,
      stepKey: request.stepKey,
      layoutJsonPath,
    })

    if (!prep.fromCache) {
      await generateLayoutTiles(layoutJsonPath, prep.outDir)
      await finalizeLayoutTileCacheMeta({
        projectRoot,
        outDir: prep.outDir,
        layoutJsonPath,
        contentSha256: prep.contentSha256,
      })
    }

    return {
      baseUrl: pathToFileURL(prep.outDir).href,
      outDir: prep.outDir,
      fromCache: prep.fromCache,
    }
  }
}
