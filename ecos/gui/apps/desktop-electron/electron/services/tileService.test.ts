import { describe, expect, it, vi, beforeEach } from 'vitest'

const {
  finalizeLayoutTileCacheMeta,
  generateLayoutTiles,
  prepareLayoutTileCache,
} = vi.hoisted(() => ({
  finalizeLayoutTileCacheMeta: vi.fn(),
  generateLayoutTiles: vi.fn(),
  prepareLayoutTileCache: vi.fn(),
}))

vi.mock('@ecos-studio/tile-helper', () => ({
  finalizeLayoutTileCacheMeta,
  generateLayoutTiles,
  prepareLayoutTileCache,
}))

import { TileService, resolveLayoutJsonAbsolutePath } from './tileService'

describe('resolveLayoutJsonAbsolutePath', () => {
  it('joins relative layout paths onto the project root', () => {
    expect(resolveLayoutJsonAbsolutePath('/tmp/project', './steps/layout.json')).toBe(
      '/tmp/project/steps/layout.json',
    )
  })

  it('repairs absolute Users/ paths that are missing the leading slash', () => {
    expect(resolveLayoutJsonAbsolutePath('/tmp/project', 'Users/alice/layout.json')).toBe(
      '/Users/alice/layout.json',
    )
  })
})

describe('TileService', () => {
  beforeEach(() => {
    prepareLayoutTileCache.mockReset()
    generateLayoutTiles.mockReset()
    finalizeLayoutTileCacheMeta.mockReset()
  })

  it('returns cached bundles without regenerating them', async () => {
    prepareLayoutTileCache.mockResolvedValue({
      outDir: '/tmp/project/.ecos/tile-cache/layout/route',
      fromCache: true,
      contentSha256: 'abc123',
    })

    const service = new TileService({
      projectRootProvider: {
        getProjectRoot: vi.fn().mockResolvedValue('/tmp/project'),
      },
    })

    await expect(
      service.generate({
        projectPath: '/tmp/project',
        layoutJsonRelative: './steps/layout.json',
        stepKey: 'route',
      }),
    ).resolves.toEqual({
      baseUrl: 'file:///tmp/project/.ecos/tile-cache/layout/route',
      outDir: '/tmp/project/.ecos/tile-cache/layout/route',
      fromCache: true,
    })

    expect(prepareLayoutTileCache).toHaveBeenCalledWith({
      projectPath: '/tmp/project',
      projectRoot: '/tmp/project',
      stepKey: 'route',
      layoutJsonPath: '/tmp/project/steps/layout.json',
    })
    expect(generateLayoutTiles).not.toHaveBeenCalled()
    expect(finalizeLayoutTileCacheMeta).not.toHaveBeenCalled()
  })

  it('generates and finalizes cache metadata on cache misses', async () => {
    prepareLayoutTileCache.mockResolvedValue({
      outDir: '/tmp/project/.ecos/tile-cache/layout/route',
      fromCache: false,
      contentSha256: 'abc123',
    })

    const service = new TileService({
      projectRootProvider: {
        getProjectRoot: vi.fn().mockResolvedValue('/tmp/project'),
      },
    })

    await service.generate({
      projectPath: '/tmp/project',
      layoutJsonRelative: './steps/layout.json',
      stepKey: 'route',
    })

    expect(generateLayoutTiles).toHaveBeenCalledWith(
      '/tmp/project/steps/layout.json',
      '/tmp/project/.ecos/tile-cache/layout/route',
    )
    expect(finalizeLayoutTileCacheMeta).toHaveBeenCalledWith({
      projectRoot: '/tmp/project',
      outDir: '/tmp/project/.ecos/tile-cache/layout/route',
      layoutJsonPath: '/tmp/project/steps/layout.json',
      contentSha256: 'abc123',
    })
  })
})
