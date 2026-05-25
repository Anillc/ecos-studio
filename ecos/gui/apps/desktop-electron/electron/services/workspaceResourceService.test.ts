import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WorkspaceResourceService } from './workspaceResourceService'

const tempDirectories: string[] = []
type ProjectScopeProviderDouble = ConstructorParameters<typeof WorkspaceResourceService>[0]['projectScopeProvider']

async function tempWorkspace(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'ecos-resource-resolver-'))
  tempDirectories.push(directory)
  return directory
}

function provider(root: string): ProjectScopeProviderDouble {
  return {
    getProjectRoot: vi.fn().mockResolvedValue(root),
    requestProjectPathAccess: vi.fn(async (path: string) => path),
  }
}

async function writeJson(path: string, data: unknown): Promise<void> {
  await writeFile(path, JSON.stringify(data, null, 2), 'utf8')
}

describe('WorkspaceResourceService', () => {
  afterEach(async () => {
    await Promise.all(
      tempDirectories.splice(0).map((directory) =>
        rm(directory, { force: true, recursive: true }),
      ),
    )
  })

  it('builds an ECC step resource index from parameters and flow files', async () => {
    const root = await tempWorkspace()
    await mkdir(join(root, 'home'), { recursive: true })
    await mkdir(join(root, 'place_ecc', 'output'), { recursive: true })
    await mkdir(join(root, 'place_ecc', 'analysis'), { recursive: true })
    await writeJson(join(root, 'home', 'parameters.json'), {
      Design: 'gcd',
      'Top module': 'gcd',
      PDK: 'ics55',
    })
    await writeJson(join(root, 'home', 'flow.json'), {
      steps: [{ name: 'place', tool: 'ecc', state: 'Success', runtime: '00:00:01', info: {} }],
    })
    await writeJson(join(root, 'home', 'home.json'), { flow: join(root, 'home', 'flow.json') })
    await writeFile(join(root, 'place_ecc', 'output', 'gcd_place.json'), '{}', 'utf8')
    await writeFile(join(root, 'place_ecc', 'output', 'gcd_place.png'), 'png', 'utf8')
    await writeFile(join(root, 'place_ecc', 'analysis', 'place_metrics.json'), '{}', 'utf8')

    const service = new WorkspaceResourceService({ projectScopeProvider: provider(root) })
    const index = await service.getIndex()

    expect(index.status).toBe('available')
    expect(index.design).toBe('gcd')
    expect(index.topModule).toBe('gcd')
    expect(index.pdk).toBe('ics55')
    expect(index.flow.steps).toHaveLength(1)
    expect(index.flow.steps[0].directory).toBe(join(root, 'place_ecc'))
    expect(index.flow.steps[0].resources.output.json).toMatchObject({
      path: join(root, 'place_ecc', 'output', 'gcd_place.json'),
      exists: true,
      kind: 'layout-json',
    })
    expect(index.flow.steps[0].resources.output.image).toMatchObject({
      path: join(root, 'place_ecc', 'output', 'gcd_place.png'),
      exists: true,
      kind: 'layout-image',
    })
  })

  it('returns resolveStepInfo(layout) with missing files instead of throwing', async () => {
    const root = await tempWorkspace()
    await mkdir(join(root, 'home'), { recursive: true })
    await writeJson(join(root, 'home', 'parameters.json'), {
      Design: 'gcd',
      'Top module': 'gcd',
      PDK: 'ics55',
    })
    await writeJson(join(root, 'home', 'flow.json'), {
      steps: [{ name: 'route', tool: 'ecc', state: 'Unstart', runtime: '', info: {} }],
    })
    await writeJson(join(root, 'home', 'home.json'), {})

    const service = new WorkspaceResourceService({ projectScopeProvider: provider(root) })
    const result = await service.resolveStepInfo({ step: 'ROUTE', id: 'layout' })

    expect(result).toMatchObject({
      step: 'route',
      id: 'layout',
      response: 'missing',
      info: {
        image: join(root, 'route_ecc', 'output', 'gcd_route.png'),
        json: join(root, 'route_ecc', 'output', 'gcd_route.json'),
      },
    })
    expect(result.missing).toEqual(expect.arrayContaining([
      join(root, 'route_ecc', 'output', 'gcd_route.png'),
      join(root, 'route_ecc', 'output', 'gcd_route.json'),
    ]))
  })

  it('maps yosys config to flow_config.json', async () => {
    const root = await tempWorkspace()
    await mkdir(join(root, 'home'), { recursive: true })
    await writeJson(join(root, 'home', 'parameters.json'), {
      Design: 'gcd',
      'Top module': 'gcd',
      PDK: 'ics55',
    })
    await writeJson(join(root, 'home', 'flow.json'), {
      steps: [{ name: 'Synthesis', tool: 'yosys', state: 'Success', runtime: '', info: {} }],
    })
    await writeJson(join(root, 'home', 'home.json'), {})

    const service = new WorkspaceResourceService({ projectScopeProvider: provider(root) })
    const result = await service.resolveStepInfo({ step: 'synthesis', id: 'config' })

    expect(result).toMatchObject({
      step: 'Synthesis',
      response: 'missing',
      info: { path: join(root, 'config', 'flow_config.json') },
      missing: [join(root, 'config', 'flow_config.json')],
    })
  })

  it('marks the index missing when parameters or flow files are absent', async () => {
    const root = await tempWorkspace()
    await mkdir(join(root, 'home'), { recursive: true })

    const service = new WorkspaceResourceService({ projectScopeProvider: provider(root) })
    const index = await service.getIndex()

    expect(index.status).toBe('missing')
    expect(index.parameters).toBeNull()
    expect(index.flow.steps).toEqual([])
    expect(index.messages).toEqual(expect.arrayContaining([
      `Missing workspace parameters: ${join(root, 'home', 'parameters.json')}`,
      `Missing workspace flow: ${join(root, 'home', 'flow.json')}`,
    ]))
  })

  it('marks the index error when workspace JSON is malformed', async () => {
    const root = await tempWorkspace()
    await mkdir(join(root, 'home'), { recursive: true })
    await writeFile(join(root, 'home', 'parameters.json'), '{', 'utf8')
    await writeJson(join(root, 'home', 'flow.json'), { steps: [] })

    const service = new WorkspaceResourceService({ projectScopeProvider: provider(root) })
    const index = await service.getIndex()

    expect(index.status).toBe('error')
    expect(index.messages.join('\n')).toContain('Failed to parse')
  })
})
