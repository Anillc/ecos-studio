import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
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
})
