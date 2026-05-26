const testState = vi.hoisted(() => ({
  currentProject: null as import('vue').Ref<{ path: string } | null> | null,
  readProjectTextFile: vi.fn(),
  resolveProjectPathAccess: vi.fn(async (path: string) => path),
  resolveWorkspaceStepInfoApi: vi.fn(),
  route: {
    path: '/workspace/floorplan',
  },
}))

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref, type EffectScope } from 'vue'

vi.mock('vue-router', () => ({
  useRoute: () => testState.route,
}))

vi.mock('./useWorkspace', () => ({
  useWorkspace: () => ({
    currentProject: testState.currentProject,
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
  writeProjectTextFile: vi.fn(),
}))

vi.mock('@/utils/projectFs', () => ({
  resolveProjectPathAccess: testState.resolveProjectPathAccess,
}))

import { useStepConfigInfo } from './useStepConfigInfo'

describe('useStepConfigInfo', () => {
  let scope: EffectScope

  beforeEach(() => {
    scope = effectScope()
    testState.currentProject = ref({ path: '/workspace/demo' })
    testState.route.path = '/workspace/floorplan'
    testState.readProjectTextFile.mockReset()
    testState.resolveProjectPathAccess.mockClear()
    testState.resolveWorkspaceStepInfoApi.mockReset()
  })

  afterEach(() => {
    scope.stop()
  })

  it('treats missing config info without a config path as an empty state', async () => {
    testState.resolveWorkspaceStepInfoApi.mockResolvedValue({
      response: 'missing',
      info: {},
      missing: ['config'],
      message: ['No config path for Floorplan'],
      id: 'config',
      step: 'Floorplan',
    })

    const result = scope.run(() => useStepConfigInfo())!

    await vi.waitFor(() => {
      expect(result.loading.value).toBe(false)
    })

    expect(result.responseKind.value).toBe('idle')
    expect(result.isEmpty.value).toBe(true)
    expect(result.stepConfigPathResolved.value).toBeNull()
    expect(testState.readProjectTextFile).not.toHaveBeenCalled()
  })

  it('keeps non-config missing metadata from rendering a blank config panel', async () => {
    testState.resolveWorkspaceStepInfoApi.mockResolvedValue({
      response: 'missing',
      info: {
        metrics: '/workspace/demo/Floorplan/metrics.json',
      },
      missing: ['config'],
      message: ['No config path for Floorplan'],
      id: 'config',
      step: 'Floorplan',
    })

    const result = scope.run(() => useStepConfigInfo())!

    await vi.waitFor(() => {
      expect(result.loading.value).toBe(false)
    })

    expect(result.responseKind.value).toBe('idle')
    expect(result.isEmpty.value).toBe(true)
    expect(result.stepConfigPathResolved.value).toBeNull()
    expect(testState.readProjectTextFile).not.toHaveBeenCalled()
  })

  it('keeps missing config info with a config path in warning state and loads the file', async () => {
    testState.resolveWorkspaceStepInfoApi.mockResolvedValue({
      response: 'missing',
      info: {
        config: '/workspace/demo/config/fp_default_config.json',
      },
      missing: ['config/fp_default_config.json'],
      message: ['Config file is missing'],
      id: 'config',
      step: 'Floorplan',
    })
    testState.readProjectTextFile.mockResolvedValue('{"FP":{}}')

    const result = scope.run(() => useStepConfigInfo())!

    await vi.waitFor(() => {
      expect(result.loading.value).toBe(false)
    })

    expect(result.responseKind.value).toBe('warning')
    expect(result.isEmpty.value).toBe(false)
    expect(result.stepConfigPathResolved.value).toBe('/workspace/demo/config/fp_default_config.json')
    expect(testState.readProjectTextFile).toHaveBeenCalledWith('/workspace/demo/config/fp_default_config.json')
  })
})
