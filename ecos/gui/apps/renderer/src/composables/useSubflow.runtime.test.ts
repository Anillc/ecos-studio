const testState = vi.hoisted(() => ({
  currentProject: null as import('vue').Ref<{ path: string } | null> | null,
  readProjectTextFile: vi.fn(),
  resolveProjectPathAccess: vi.fn(async (path: string) => path),
  resolveWorkspaceStepInfoApi: vi.fn(),
  route: {
    path: '/workspace/Floorplan',
  },
  runtimeEvents: null as import('vue').Ref<unknown[]> | null,
  stepRefreshCounter: null as import('vue').Ref<number> | null,
}))

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

vi.mock('vue-router', () => ({
  useRoute: () => testState.route,
}))

vi.mock('./useWorkspace', () => ({
  useWorkspace: () => ({
    currentProject: testState.currentProject,
    runtimeEvents: testState.runtimeEvents,
    stepRefreshCounter: testState.stepRefreshCounter,
  }),
}))

vi.mock('./useDesktopRuntime', () => ({
  useDesktopRuntime: () => ({
    isDesktopRuntimeAvailable: true,
  }),
}))

vi.mock('./useHomeData', () => ({
  convertRemoteToLocalPath: (path: string) => path,
}))

vi.mock('@/api/workspaceResources', () => ({
  resolveWorkspaceStepInfoApi: testState.resolveWorkspaceStepInfoApi,
}))

vi.mock('@/utils/projectFiles', () => ({
  readProjectTextFile: testState.readProjectTextFile,
}))

vi.mock('@/utils/projectFs', () => ({
  resolveProjectPathAccess: testState.resolveProjectPathAccess,
}))

import { useSubflow } from './useSubflow'

describe('useSubflow runtime refresh', () => {
  beforeEach(() => {
    testState.currentProject = ref({ path: '/workspace/demo' })
    testState.route.path = '/workspace/floorplan'
    testState.runtimeEvents = ref([])
    testState.stepRefreshCounter = ref(0)
    testState.readProjectTextFile.mockReset()
    testState.resolveProjectPathAccess.mockClear()
    testState.resolveWorkspaceStepInfoApi.mockReset()

    testState.resolveWorkspaceStepInfoApi.mockResolvedValue({
      response: 'available',
      info: {
        path: '/workspace/demo/Floorplan/subflow.json',
      },
      missing: [],
      message: [],
      id: 'subflow',
      step: 'Floorplan',
    })
    testState.readProjectTextFile.mockResolvedValue(JSON.stringify({
      path: '/workspace/demo/Floorplan/subflow.json',
      steps: [
        {
          name: 'floorplan',
          state: 'Success',
          runtime: '1.0s',
          'peak memory (mb)': 12,
          info: {},
        },
      ],
    }))
  })

  it('reloads the current subflow when the workspace step refresh counter changes', async () => {
    useSubflow()

    await vi.waitFor(() => {
      expect(testState.resolveWorkspaceStepInfoApi).toHaveBeenCalledTimes(1)
    })

    testState.stepRefreshCounter!.value += 1
    await nextTick()

    await vi.waitFor(() => {
      expect(testState.resolveWorkspaceStepInfoApi).toHaveBeenCalledTimes(2)
    })
  })
})
