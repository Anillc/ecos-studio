import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const testState = vi.hoisted(() => ({
  currentProject: null as import('vue').Ref<{ path: string } | null> | null,
  flowExecutionActive: null as import('vue').Ref<boolean> | null,
  sseMessages: null as import('vue').Ref<unknown[]> | null,
  getHomePageApi: vi.fn(),
  readProjectBlobUrl: vi.fn(),
  readProjectTextFile: vi.fn(),
  requestProjectPathAccess: vi.fn(),
  resolveProjectPathAccess: vi.fn(),
  watchProjectFile: vi.fn(),
  watchers: [] as Array<{ path: string; unwatch: ReturnType<typeof vi.fn> }>,
}))

vi.mock('vue', async () => {
  const actual = await vi.importActual<typeof import('vue')>('vue')
  return {
    ...actual,
    onUnmounted: vi.fn(),
  }
})

vi.mock('./useWorkspace', async () => {
  const { ref } = await vi.importActual<typeof import('vue')>('vue')
  testState.currentProject ??= ref(null)
  testState.sseMessages ??= ref([])
  return {
    useWorkspace: () => ({
      currentProject: testState.currentProject,
      sseMessages: testState.sseMessages,
    }),
  }
})

vi.mock('./useTauri', () => ({
  useTauri: () => ({
    isInTauri: true,
  }),
}))

vi.mock('./useFlowRunner', async () => {
  const { ref } = await vi.importActual<typeof import('vue')>('vue')
  testState.flowExecutionActive ??= ref(false)
  return {
    flowExecutionActive: testState.flowExecutionActive,
  }
})

vi.mock('@/api/flow', () => ({
  getHomePageApi: testState.getHomePageApi,
}))

vi.mock('@/utils/projectFiles', () => ({
  readProjectBlobUrl: testState.readProjectBlobUrl,
  readProjectTextFile: testState.readProjectTextFile,
  watchProjectFile: testState.watchProjectFile,
}))

vi.mock('@/utils/projectFs', () => ({
  requestProjectPathAccess: testState.requestProjectPathAccess,
  resolveProjectPathAccess: testState.resolveProjectPathAccess,
}))

function homeDataFor(projectPath: string) {
  return {
    flow: `${projectPath}/home/flow.json`,
    layout: '',
    parameters: '',
    'GDS merge': '',
    checklist: '',
    metrics: {},
    monitor: { step: [] },
  }
}

function flowJsonFor(stepName: string) {
  return JSON.stringify({
    steps: [
      {
        name: stepName,
        tool: 'yosys',
        state: 'Ongoing',
      },
    ],
  })
}

async function importFreshHomeDataModule() {
  vi.resetModules()
  return await import('./useHomeData')
}

describe('useHomeData live project file watchers', () => {
  beforeEach(async () => {
    const { ref } = await import('vue')
    testState.currentProject ??= ref(null)
    testState.flowExecutionActive ??= ref(false)
    testState.sseMessages ??= ref([])

    vi.useFakeTimers()
    testState.watchers.length = 0
    testState.getHomePageApi.mockReset()
    testState.readProjectBlobUrl.mockReset()
    testState.readProjectTextFile.mockReset()
    testState.requestProjectPathAccess.mockReset()
    testState.resolveProjectPathAccess.mockReset()
    testState.watchProjectFile.mockReset()

    testState.currentProject!.value = { path: '/workspace/a' }
    testState.flowExecutionActive!.value = false
    testState.sseMessages!.value = []

    testState.getHomePageApi.mockImplementation(async () => ({
      response: 'success',
      data: {
        path: `${testState.currentProject!.value?.path ?? '/workspace/a'}/home/home.json`,
      },
      message: [],
    }))
    testState.requestProjectPathAccess.mockResolvedValue(true)
    testState.resolveProjectPathAccess.mockImplementation(async (path: string) => path)
    testState.watchProjectFile.mockImplementation(async (path: string) => {
      const unwatch = vi.fn()
      testState.watchers.push({ path, unwatch })
      return unwatch
    })
    testState.readProjectBlobUrl.mockResolvedValue('blob:unused')
    testState.readProjectTextFile.mockImplementation(async (path: string) => {
      if (path.endsWith('/home/home.json')) {
        const projectPath = path.replace(/\/home\/home\.json$/, '')
        return JSON.stringify(homeDataFor(projectPath))
      }
      if (path === '/workspace/a/home/flow.json') return flowJsonFor('Synthesis')
      if (path === '/workspace/b/home/flow.json') return flowJsonFor('Floorplan')
      if (path.includes('/Synthesis_yosys/log/Synthesis.log')) return 'a live log'
      if (path.includes('/Floorplan_yosys/log/Floorplan.log')) return 'b live log'
      return '{}'
    })
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('rebases live watchers when the current project changes during an active flow', async () => {
    const { useHomeData } = await importFreshHomeDataModule()
    testState.flowExecutionActive!.value = true

    useHomeData()

    await vi.waitFor(() => {
      expect(testState.watchProjectFile).toHaveBeenCalledWith(
        '/workspace/a/home/flow.json',
        expect.any(Function),
      )
    })

    const firstFlowWatch = testState.watchers.find((watcher) =>
      watcher.path === '/workspace/a/home/flow.json'
    )
    expect(firstFlowWatch).toBeDefined()

    testState.currentProject!.value = { path: '/workspace/b' }

    await vi.waitFor(() => {
      expect(testState.watchProjectFile).toHaveBeenCalledWith(
        '/workspace/b/home/flow.json',
        expect.any(Function),
      )
    })

    expect(firstFlowWatch!.unwatch).toHaveBeenCalled()
  })

  it('does not create stale fallback timers after a live session stops during log setup', async () => {
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval')
    let resolveLogRead: ((content: string) => void) | null = null
    const pendingLogRead = new Promise<string>((resolve) => {
      resolveLogRead = resolve
    })

    testState.readProjectTextFile.mockImplementation(async (path: string) => {
      if (path.endsWith('/home/home.json')) {
        const projectPath = path.replace(/\/home\/home\.json$/, '')
        return JSON.stringify(homeDataFor(projectPath))
      }
      if (path === '/workspace/a/home/flow.json') return flowJsonFor('Synthesis')
      if (path.includes('/Synthesis_yosys/log/Synthesis.log')) return await pendingLogRead
      return '{}'
    })

    const { useHomeData } = await importFreshHomeDataModule()
    testState.flowExecutionActive!.value = true

    useHomeData()

    await vi.waitFor(() => {
      expect(testState.readProjectTextFile).toHaveBeenCalledWith(
        '/workspace/a/Synthesis_yosys/log/Synthesis.log',
      )
    })
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 1600)

    testState.flowExecutionActive!.value = false
    await Promise.resolve()

    resolveLogRead!('late log content')
    for (let i = 0; i < 10; i += 1) {
      await Promise.resolve()
    }

    expect(
      setIntervalSpy.mock.calls.filter(([, delay]) => delay === 650),
    ).toHaveLength(0)
  })
})
