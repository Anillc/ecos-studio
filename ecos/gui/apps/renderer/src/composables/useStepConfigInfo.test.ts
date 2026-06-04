const testState = vi.hoisted(() => ({
  currentProject: null as import('vue').Ref<{ path: string } | null> | null,
  readProjectTextFile: vi.fn(),
  resolveProjectPathAccess: vi.fn(async (path: string) => path),
  resolveWorkspaceStepInfoApi: vi.fn(),
  route: {
    path: '/workspace/floorplan',
  },
  writeProjectTextFile: vi.fn(),
}))

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref, type EffectScope } from 'vue'

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
  writeProjectTextFile: testState.writeProjectTextFile,
}))

vi.mock('@/utils/projectFs', () => ({
  resolveProjectPathAccess: testState.resolveProjectPathAccess,
}))

import { useStepConfigInfo } from './useStepConfigInfo'
import { useWorkspaceLifecycle } from './useWorkspaceLifecycle'

describe('useStepConfigInfo', () => {
  let scope: EffectScope

  beforeEach(() => {
    scope = effectScope()
    const lifecycle = useWorkspaceLifecycle()
    lifecycle.closeSession()
    const session = lifecycle.beginSession({
      workspaceId: 'workspace-demo',
      projectRoot: '/workspace/demo',
    })
    lifecycle.activateSession(session.sessionId)
    testState.currentProject = ref({ path: '/workspace/demo' })
    testState.route.path = '/workspace/floorplan'
    testState.readProjectTextFile.mockReset()
    testState.resolveProjectPathAccess.mockClear()
    testState.resolveWorkspaceStepInfoApi.mockReset()
    testState.writeProjectTextFile.mockReset()
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

  it('ignores stale step config reads after the workspace session changes', async () => {
    let resolveOldRead: ((content: string) => void) | undefined
    testState.resolveWorkspaceStepInfoApi
      .mockResolvedValueOnce({
        response: 'available',
        info: {
          config: '/workspace/demo/config/fp_default_config.json',
        },
        missing: [],
        message: [],
        id: 'config',
        step: 'Floorplan',
      })
      .mockResolvedValueOnce({
        response: 'available',
        info: {
          config: '/workspace/other/config/fp_default_config.json',
        },
        missing: [],
        message: [],
        id: 'config',
        step: 'Floorplan',
      })
    testState.readProjectTextFile
      .mockReturnValueOnce(new Promise((resolve) => {
        resolveOldRead = resolve
      }))
      .mockResolvedValueOnce('{"owner":"current"}')

    const result = scope.run(() => useStepConfigInfo())!

    await vi.waitFor(() => {
      expect(testState.readProjectTextFile).toHaveBeenCalledTimes(1)
    })

    const lifecycle = useWorkspaceLifecycle()
    const nextSession = lifecycle.beginSession({
      workspaceId: 'workspace-other',
      projectRoot: '/workspace/other',
    })
    lifecycle.activateSession(nextSession.sessionId)
    testState.currentProject!.value = { path: '/workspace/other' }
    void result.refetch()

    await vi.waitFor(() => {
      expect(result.stepConfigRaw.value).toBe('{"owner":"current"}')
    })

    resolveOldRead?.('{"owner":"stale"}')
    await nextTick()

    expect(result.stepConfigRaw.value).toBe('{"owner":"current"}')
    expect(result.stepConfigPathResolved.value).toBe('/workspace/other/config/fp_default_config.json')
  })

  it('ignores older same-session refetch completions after a newer refetch wins', async () => {
    let resolveOldResponse: ((response: {
      response: 'available'
      info: { config: string }
      missing: string[]
      message: string[]
      id: string
      step: string
    }) => void) | undefined
    testState.resolveWorkspaceStepInfoApi
      .mockReturnValueOnce(new Promise((resolve) => {
        resolveOldResponse = resolve
      })
      )
      .mockResolvedValueOnce({
        response: 'available',
        info: {
          config: '/workspace/demo/config/fp_b.json',
        },
        missing: [],
        message: ['B'],
        id: 'config',
        step: 'Floorplan',
      })
    testState.readProjectTextFile.mockImplementation(async (path: string) => (
      path.includes('fp_a.json') ? '{"owner":"A"}' : '{"owner":"B"}'
    ))

    const result = scope.run(() => useStepConfigInfo())!

    await vi.waitFor(() => {
      expect(testState.resolveWorkspaceStepInfoApi).toHaveBeenCalledTimes(1)
    })

    const newerRefetch = result.refetch()

    await vi.waitFor(() => {
      expect(result.stepConfigRaw.value).toBe('{"owner":"B"}')
    })
    await newerRefetch

    resolveOldResponse?.({
      response: 'available',
      info: {
        config: '/workspace/demo/config/fp_a.json',
      },
      missing: [],
      message: ['A'],
      id: 'config',
      step: 'Floorplan',
    })
    await nextTick()

    expect(result.stepConfigRaw.value).toBe('{"owner":"B"}')
    expect(result.stepConfigPathResolved.value).toBe('/workspace/demo/config/fp_b.json')
    expect(result.runtimeMessages.value).toEqual(['B'])
    expect(result.responseKind.value).toBe('success')
    expect(result.loading.value).toBe(false)
    expect(testState.readProjectTextFile).not.toHaveBeenCalledWith('/workspace/demo/config/fp_a.json')
  })

  it('reloads the current step when step config resource versions change', async () => {
    testState.resolveWorkspaceStepInfoApi.mockResolvedValue({
      response: 'available',
      info: {
        config: '/workspace/demo/config/fp_default_config.json',
      },
      missing: [],
      message: [],
      id: 'config',
      step: 'Floorplan',
    })
    testState.readProjectTextFile.mockResolvedValue('{"FP":{}}')

    scope.run(() => useStepConfigInfo())!

    await vi.waitFor(() => {
      expect(testState.resolveWorkspaceStepInfoApi).toHaveBeenCalledTimes(1)
    })

    const lifecycle = useWorkspaceLifecycle()
    lifecycle.invalidate('step-config')
    await nextTick()

    await vi.waitFor(() => {
      expect(testState.resolveWorkspaceStepInfoApi).toHaveBeenCalledTimes(2)
    })

    lifecycle.invalidate('all')
    await nextTick()

    await vi.waitFor(() => {
      expect(testState.resolveWorkspaceStepInfoApi).toHaveBeenCalledTimes(3)
    })
  })

  it('save writes the config and updates the local baseline', async () => {
    testState.resolveWorkspaceStepInfoApi.mockResolvedValue({
      response: 'available',
      info: {
        config: '/workspace/demo/config/fp_default_config.json',
      },
      missing: [],
      message: [],
      id: 'config',
      step: 'Floorplan',
    })
    testState.readProjectTextFile
      .mockResolvedValueOnce('{"density":0.5}')
      .mockResolvedValue('{\n    "density": 0.6\n}')

    const result = scope.run(() => useStepConfigInfo())!

    await vi.waitFor(() => {
      expect(result.stepConfigDraft.value).toEqual({ density: 0.5 })
    })

    result.stepConfigDraft.value = { density: 0.6 }

    expect(result.hasStepConfigChanges.value).toBe(true)
    const lifecycle = useWorkspaceLifecycle()
    const stepConfigVersionBeforeSave = lifecycle.resourceVersions.value['step-config']
    await expect(result.saveStepConfig()).resolves.toBe(true)

    expect(testState.writeProjectTextFile).toHaveBeenCalledWith(
      '/workspace/demo/config/fp_default_config.json',
      '{\n    "density": 0.6\n}',
    )
    expect(lifecycle.resourceVersions.value['step-config']).toBe(stepConfigVersionBeforeSave + 1)
    await vi.waitFor(() => {
      expect(result.stepConfigRaw.value).toBe('{\n    "density": 0.6\n}')
      expect(result.hasStepConfigChanges.value).toBe(false)
    })
  })

  it('ignores stale step config save completions after the workspace session changes', async () => {
    let resolveWrite: (() => void) | undefined
    testState.resolveWorkspaceStepInfoApi.mockResolvedValue({
      response: 'available',
      info: {
        config: '/workspace/demo/config/fp_default_config.json',
      },
      missing: [],
      message: [],
      id: 'config',
      step: 'Floorplan',
    })
    testState.readProjectTextFile.mockResolvedValue('{"density":0.5}')
    testState.writeProjectTextFile.mockReturnValue(new Promise<void>((resolve) => {
      resolveWrite = resolve
    }))

    const result = scope.run(() => useStepConfigInfo())!

    await vi.waitFor(() => {
      expect(result.stepConfigDraft.value).toEqual({ density: 0.5 })
    })

    result.stepConfigDraft.value = { density: 0.6 }
    expect(result.hasStepConfigChanges.value).toBe(true)

    const savePromise = result.saveStepConfig()

    await vi.waitFor(() => {
      expect(testState.writeProjectTextFile).toHaveBeenCalledTimes(1)
    })

    const lifecycle = useWorkspaceLifecycle()
    const nextSession = lifecycle.beginSession({
      workspaceId: 'workspace-other',
      projectRoot: '/workspace/other',
    })
    lifecycle.activateSession(nextSession.sessionId)
    testState.currentProject!.value = { path: '/workspace/other' }
    const nextStepConfigVersion = lifecycle.resourceVersions.value['step-config']

    resolveWrite?.()
    await expect(savePromise).resolves.toBe(false)

    expect(result.stepConfigRaw.value).toBe('{"density":0.5}')
    expect(result.hasStepConfigChanges.value).toBe(true)
    expect(lifecycle.resourceVersions.value['step-config']).toBe(nextStepConfigVersion)
  })

  it('keeps the newer same-session save result when an older save resolves last', async () => {
    let resolveOldWrite: (() => void) | undefined
    testState.resolveWorkspaceStepInfoApi.mockResolvedValue({
      response: 'available',
      info: {
        config: '/workspace/demo/config/fp_default_config.json',
      },
      missing: [],
      message: [],
      id: 'config',
      step: 'Floorplan',
    })
    testState.readProjectTextFile
      .mockResolvedValueOnce('{"density":0.5}')
      .mockResolvedValue('{\n    "density": 0.8\n}')
    testState.writeProjectTextFile
      .mockReturnValueOnce(new Promise<void>((resolve) => {
        resolveOldWrite = resolve
      }))
      .mockResolvedValueOnce(undefined)

    const result = scope.run(() => useStepConfigInfo())!

    await vi.waitFor(() => {
      expect(result.stepConfigDraft.value).toEqual({ density: 0.5 })
    })

    const lifecycle = useWorkspaceLifecycle()
    const stepConfigVersionBeforeSave = lifecycle.resourceVersions.value['step-config']

    result.stepConfigDraft.value = { density: 0.6 }
    const oldSave = result.saveStepConfig()

    await vi.waitFor(() => {
      expect(testState.writeProjectTextFile).toHaveBeenCalledTimes(1)
    })

    result.stepConfigDraft.value = { density: 0.8 }
    const newerSave = result.saveStepConfig()

    await expect(newerSave).resolves.toBe(true)
    expect(result.stepConfigRaw.value).toBe('{\n    "density": 0.8\n}')
    expect(result.hasStepConfigChanges.value).toBe(false)
    expect(lifecycle.resourceVersions.value['step-config']).toBe(stepConfigVersionBeforeSave + 1)

    resolveOldWrite?.()
    await expect(oldSave).resolves.toBe(false)

    expect(result.stepConfigRaw.value).toBe('{\n    "density": 0.8\n}')
    expect(result.hasStepConfigChanges.value).toBe(false)
    expect(lifecycle.resourceVersions.value['step-config']).toBe(stepConfigVersionBeforeSave + 1)
  })

  it('captures the save payload before awaited path resolution completes', async () => {
    let resolveSavePath: ((path: string) => void) | undefined
    testState.resolveWorkspaceStepInfoApi.mockResolvedValue({
      response: 'available',
      info: {
        config: '/workspace/demo/config/fp_default_config.json',
      },
      missing: [],
      message: [],
      id: 'config',
      step: 'Floorplan',
    })
    testState.resolveProjectPathAccess
      .mockResolvedValueOnce('/workspace/demo/config/fp_default_config.json')
      .mockReturnValueOnce(new Promise((resolve) => {
        resolveSavePath = resolve
      }))
    testState.readProjectTextFile.mockResolvedValue('{"density":0.5}')
    testState.writeProjectTextFile.mockResolvedValue(undefined)

    const result = scope.run(() => useStepConfigInfo())!

    await vi.waitFor(() => {
      expect(result.stepConfigDraft.value).toEqual({ density: 0.5 })
    })

    result.stepConfigDraft.value = { density: 0.6 }
    const savePromise = result.saveStepConfig()

    await vi.waitFor(() => {
      expect(testState.resolveProjectPathAccess).toHaveBeenCalledTimes(2)
    })

    result.stepConfigDraft.value = { density: 0.8 }
    resolveSavePath?.('/workspace/demo/config/fp_default_config.json')

    await expect(savePromise).resolves.toBe(true)
    expect(testState.writeProjectTextFile).toHaveBeenCalledWith(
      '/workspace/demo/config/fp_default_config.json',
      '{\n    "density": 0.6\n}',
    )
  })
})
