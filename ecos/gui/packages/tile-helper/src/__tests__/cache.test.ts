import { mkdtemp, mkdir, readFile, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import { finalizeLayoutTileCacheMeta, prepareLayoutTileCache } from '../cache'

const tempRoots: string[] = []

async function createProjectFixture() {
  const projectRoot = await mkdtemp(join(tmpdir(), 'tile-helper-cache-'))
  tempRoots.push(projectRoot)
  const homeDir = join(projectRoot, 'home')
  await mkdir(homeDir, { recursive: true })
  const layoutJsonPath = join(homeDir, 'layout.json')
  await writeFile(layoutJsonPath, JSON.stringify({ diearea: { path: [] } }), 'utf8')
  return {
    projectRoot,
    projectPath: projectRoot,
    layoutJsonPath,
  }
}

afterEach(async () => {
  await Promise.all(
    tempRoots.splice(0).map(async (root) => {
      await import('node:fs/promises').then(({ rm }) =>
        rm(root, { recursive: true, force: true }),
      )
    }),
  )
})

describe('prepareLayoutTileCache', () => {
  it('creates the cache directory at <active root>/.ecos/tile-cache/layout/<sanitizedStepKey>', async () => {
    const fixture = await createProjectFixture()

    const result = await prepareLayoutTileCache({
      projectPath: fixture.projectPath,
      projectRoot: fixture.projectRoot,
      stepKey: '  route / main.v2  ',
      layoutJsonPath: fixture.layoutJsonPath,
    })

    expect(result.fromCache).toBe(false)
    expect(result.outDir).toBe(
      join(fixture.projectRoot, '.ecos', 'tile-cache', 'layout', 'route_main_v2'),
    )
  })

  it('clears a stale step directory before recreating it on cache miss', async () => {
    const fixture = await createProjectFixture()
    const staleDir = join(
      fixture.projectRoot,
      '.ecos',
      'tile-cache',
      'layout',
      'route_main_v2',
    )
    await mkdir(staleDir, { recursive: true })
    await writeFile(join(staleDir, 'orphan.txt'), 'stale', 'utf8')

    await prepareLayoutTileCache({
      projectPath: fixture.projectPath,
      projectRoot: fixture.projectRoot,
      stepKey: 'route / main.v2',
      layoutJsonPath: fixture.layoutJsonPath,
    })

    await expect(readFile(join(staleDir, 'orphan.txt'), 'utf8')).rejects.toThrow()
  })

  it('rejects a symlinked cache-parent escape before removing or recreating the target directory', async () => {
    const fixture = await createProjectFixture()
    const escapedCacheRoot = await mkdtemp(join(tmpdir(), 'tile-helper-cache-escape-'))
    tempRoots.push(escapedCacheRoot)

    await mkdir(join(fixture.projectRoot, '.ecos'), { recursive: true })
    await symlink(escapedCacheRoot, join(fixture.projectRoot, '.ecos', 'tile-cache'))

    const escapedStepDir = join(escapedCacheRoot, 'layout', 'route')
    const escapedMarkerPath = join(escapedStepDir, 'orphan.txt')
    await mkdir(escapedStepDir, { recursive: true })
    await writeFile(escapedMarkerPath, 'outside-root', 'utf8')

    await expect(
      prepareLayoutTileCache({
        projectPath: fixture.projectPath,
        projectRoot: fixture.projectRoot,
        stepKey: 'route',
        layoutJsonPath: fixture.layoutJsonPath,
      }),
    ).rejects.toThrow(`Refusing tile cache out_dir outside ${join(
      fixture.projectRoot,
      '.ecos',
      'tile-cache',
      'layout',
    )}`)

    await expect(readFile(escapedMarkerPath, 'utf8')).resolves.toBe('outside-root')
  })

  it('returns fromCache=true only after both manifest.json and tile-cache.meta.json match the current layout hash', async () => {
    const fixture = await createProjectFixture()
    const first = await prepareLayoutTileCache({
      projectPath: fixture.projectPath,
      projectRoot: fixture.projectRoot,
      stepKey: 'route / main.v2',
      layoutJsonPath: fixture.layoutJsonPath,
    })
    await writeFile(join(first.outDir, 'manifest.json'), '{"version":1}\n', 'utf8')
    await finalizeLayoutTileCacheMeta({
      projectRoot: fixture.projectRoot,
      outDir: first.outDir,
      layoutJsonPath: fixture.layoutJsonPath,
      contentSha256: first.contentSha256,
    })

    const second = await prepareLayoutTileCache({
      projectPath: fixture.projectPath,
      projectRoot: fixture.projectRoot,
      stepKey: 'route / main.v2',
      layoutJsonPath: fixture.layoutJsonPath,
    })

    expect(second.fromCache).toBe(true)
    expect(second.outDir).toBe(first.outDir)
    expect(second.contentSha256).toBe(first.contentSha256)

    const meta = JSON.parse(
      await readFile(join(first.outDir, 'tile-cache.meta.json'), 'utf8'),
    ) as {
      layoutJsonPath: string
      contentSha256: string
      generatedAt: string
    }
    expect(meta.layoutJsonPath).toBe(fixture.layoutJsonPath)
    expect(meta.contentSha256).toBe(first.contentSha256)
    expect(typeof meta.generatedAt).toBe('string')
    expect(meta.generatedAt.length).toBeGreaterThan(0)
  })
})
