import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { WorkspaceService } from './workspaceService'

const tempDirectories: string[] = []

async function createTempDir(prefix: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), prefix))
  tempDirectories.push(directory)
  return directory
}

describe('WorkspaceService', () => {
  afterEach(async () => {
    await Promise.all(
      tempDirectories.splice(0).map((directory) =>
        rm(directory, { force: true, recursive: true }),
      ),
    )
  })

  it('reads project-scoped text through the validated canonical path', async () => {
    const directory = await createTempDir('ecos-workspace-service-')
    const filePath = join(directory, 'flow.json')
    await writeFile(filePath, '{"steps":[]}', 'utf8')

    const projectScopeProvider = {
      clearProjectRoot: vi.fn(),
      isProjectDirectory: vi.fn(),
      registerProjectRoot: vi.fn(),
      requestProjectPathAccess: vi.fn().mockResolvedValue(filePath),
      scanPdkDirectory: vi.fn(),
    }

    const service = new WorkspaceService({
      apiPortProvider: {
        getPort: vi.fn(),
      },
      projectScopeProvider,
    })

    await expect(
      (
        service as WorkspaceService & {
          readProjectTextFile(path: string): Promise<string>
        }
      ).readProjectTextFile('/workspace/home/flow.json'),
    ).resolves.toBe('{"steps":[]}')
    expect(projectScopeProvider.requestProjectPathAccess).toHaveBeenCalledWith(
      '/workspace/home/flow.json',
    )
  })

  it('reads project-scoped binary through the validated canonical path', async () => {
    const directory = await createTempDir('ecos-workspace-service-bin-')
    const filePath = join(directory, 'cells.bin')
    await writeFile(filePath, Buffer.from([0x45, 0x43, 0x4f, 0x53]))

    const projectScopeProvider = {
      clearProjectRoot: vi.fn(),
      isProjectDirectory: vi.fn(),
      registerProjectRoot: vi.fn(),
      requestProjectPathAccess: vi.fn().mockResolvedValue(filePath),
      scanPdkDirectory: vi.fn(),
    }

    const service = new WorkspaceService({
      apiPortProvider: {
        getPort: vi.fn(),
      },
      projectScopeProvider,
    })

    await expect(
      (
        service as WorkspaceService & {
          readProjectBinaryFile(path: string): Promise<Uint8Array>
        }
      ).readProjectBinaryFile('/workspace/.ecos/tile-cache/layout/route/cells.bin'),
    ).resolves.toEqual(Uint8Array.from([0x45, 0x43, 0x4f, 0x53]))
    expect(projectScopeProvider.requestProjectPathAccess).toHaveBeenCalledWith(
      '/workspace/.ecos/tile-cache/layout/route/cells.bin',
    )
  })

  it('writes project-scoped text through the validated canonical path', async () => {
    const directory = await createTempDir('ecos-workspace-service-write-')
    const filePath = join(directory, 'parameters.json')

    const projectScopeProvider = {
      clearProjectRoot: vi.fn(),
      isProjectDirectory: vi.fn(),
      registerProjectRoot: vi.fn(),
      requestProjectPathAccess: vi.fn().mockResolvedValue(filePath),
      scanPdkDirectory: vi.fn(),
    }

    const service = new WorkspaceService({
      apiPortProvider: {
        getPort: vi.fn(),
      },
      projectScopeProvider,
    })

    await expect(
      (
        service as WorkspaceService & {
          writeProjectTextFile(path: string, content: string): Promise<void>
        }
      ).writeProjectTextFile('/workspace/home/parameters.json', '{"PDK":"ics55"}'),
    ).resolves.toBeUndefined()

    await expect(readFile(filePath, 'utf8')).resolves.toBe('{"PDK":"ics55"}')
    expect(projectScopeProvider.requestProjectPathAccess).toHaveBeenCalledWith(
      '/workspace/home/parameters.json',
    )
  })
})
