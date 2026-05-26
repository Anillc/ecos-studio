import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  currentProject,
  fetchSharedHomeData,
  readProjectTextFile,
  runtimeEvents,
  resourceVersions,
  writeProjectTextFile,
  resolveProjectPathAccess,
} = vi.hoisted(() => ({
  currentProject: {
    value: { path: '/workspace/demo' } as { path: string } | null,
  },
  fetchSharedHomeData: vi.fn(),
  readProjectTextFile: vi.fn(),
  runtimeEvents: { value: [] },
  resourceVersions: {
    __v_isRef: true,
    value: {
      home: 0,
      flow: 0,
      parameters: 0,
      step: 0,
      'step-config': 0,
      maps: 0,
      logs: 0,
      tiles: 0,
      all: 0,
    },
  },
  writeProjectTextFile: vi.fn(),
  resolveProjectPathAccess: vi.fn(async (path: string) => path),
}))

vi.mock('./useWorkspace', () => ({
  useWorkspace: () => ({
    currentProject,
    runtimeEvents,
    resourceVersions,
  }),
}))

vi.mock('./useDesktopRuntime', () => ({
  useDesktopRuntime: () => ({
    isDesktopRuntimeAvailable: true,
  }),
}))

vi.mock('./useHomeData', () => ({
  fetchSharedHomeData,
  convertRemoteToLocalPath: (path: string) => path,
}))

vi.mock('@/utils/projectFiles', () => ({
  readProjectTextFile,
  writeProjectTextFile,
}))

vi.mock('@/utils/projectFs', () => ({
  resolveProjectPathAccess,
}))

import { useParameters } from './useParameters'
import { useWorkspaceLifecycle } from './useWorkspaceLifecycle'

describe('useParameters desktop bridge integration', () => {
  beforeEach(() => {
    const lifecycle = useWorkspaceLifecycle()
    lifecycle.closeSession()
    const session = lifecycle.beginSession({
      workspaceId: 'workspace-demo',
      projectRoot: '/workspace/demo',
    })
    lifecycle.activateSession(session.sessionId)
    currentProject.value = { path: '/workspace/demo' }
    runtimeEvents.value = []
    resourceVersions.value = {
      home: 0,
      flow: 0,
      parameters: 0,
      step: 0,
      'step-config': 0,
      maps: 0,
      logs: 0,
      tiles: 0,
      all: 0,
    }
    fetchSharedHomeData.mockReset()
    readProjectTextFile.mockReset()
    writeProjectTextFile.mockReset()
    resolveProjectPathAccess.mockClear()
  })

  it('loads and saves parameters through the bridge-backed file helpers', async () => {
    fetchSharedHomeData.mockResolvedValue({
      parameters: '/workspace/demo/home/parameters.json',
    })
    readProjectTextFile.mockResolvedValue(JSON.stringify({
      PDK: 'ics55',
      Design: 'demo',
      'Top module': 'chip_top',
      Die: { Size: [100, 100], Area: 10000 },
      Core: {
        Size: [80, 80],
        Area: 6400,
        'Bounding box': '(0,0) (80,80)',
        Utilitization: 0.5,
        Margin: [4, 4],
        'Aspect ratio': 1,
      },
      'Max fanout': 20,
      'Target density': 0.3,
      'Target overflow': 0.1,
      'Global right padding': 0,
      'Cell padding x': 600,
      'Routability opt flag': 1,
      Clock: 'clk',
      'Frequency max [MHz]': 100,
      'Bottom layer': 'MET2',
      'Top layer': 'MET5',
      'PDK Root': '/pdks/ics55',
    }))

    const parameters = useParameters()

    await vi.waitFor(() => {
      expect(readProjectTextFile).toHaveBeenCalledWith('/workspace/demo/home/parameters.json')
    })

    expect(parameters.config.design).toBe('demo')
    expect(parameters.config.topModule).toBe('chip_top')

    parameters.config.design = 'updated_demo'

    await expect(parameters.saveParameters()).resolves.toBe(true)

    expect(resolveProjectPathAccess).toHaveBeenCalledWith('/workspace/demo/home/parameters.json')
    expect(writeProjectTextFile).toHaveBeenCalledWith(
      '/workspace/demo/home/parameters.json',
      expect.stringContaining('"Design": "updated_demo"'),
    )
  })

  it('ignores stale parameter reads after the workspace session changes', async () => {
    let resolveOldRead: ((content: string) => void) | undefined
    fetchSharedHomeData
      .mockResolvedValueOnce({
        parameters: '/workspace/demo/home/parameters.json',
      })
      .mockResolvedValueOnce({
        parameters: '/workspace/other/home/parameters.json',
      })
    readProjectTextFile
      .mockReturnValueOnce(new Promise((resolve) => {
        resolveOldRead = resolve
      }))
      .mockResolvedValueOnce(JSON.stringify({
        PDK: 'ics55',
        Design: 'current-demo',
        'Top module': 'chip_top',
        Die: { Size: [100, 100], Area: 10000 },
        Core: {
          Size: [80, 80],
          Area: 6400,
          'Bounding box': '(0,0) (80,80)',
          Utilitization: 0.5,
          Margin: [4, 4],
          'Aspect ratio': 1,
        },
        'Max fanout': 20,
        'Target density': 0.3,
        'Target overflow': 0.1,
        'Global right padding': 0,
        'Cell padding x': 600,
        'Routability opt flag': 1,
        Clock: 'clk',
        'Frequency max [MHz]': 100,
        'Bottom layer': 'MET2',
        'Top layer': 'MET5',
      }))

    const parameters = useParameters()

    await vi.waitFor(() => {
      expect(readProjectTextFile).toHaveBeenCalledWith('/workspace/demo/home/parameters.json')
    })

    const lifecycle = useWorkspaceLifecycle()
    const nextSession = lifecycle.beginSession({
      workspaceId: 'workspace-other',
      projectRoot: '/workspace/other',
    })
    lifecycle.activateSession(nextSession.sessionId)
    currentProject.value = { path: '/workspace/other' }
    resourceVersions.value = {
      ...resourceVersions.value,
      parameters: 1,
    }
    void parameters.loadParameters()

    await vi.waitFor(() => {
      expect(parameters.config.design).toBe('current-demo')
    })

    resolveOldRead?.(JSON.stringify({
      PDK: 'ics55',
      Design: 'stale-demo',
      'Top module': 'old_top',
      Die: { Size: [100, 100], Area: 10000 },
      Core: {
        Size: [80, 80],
        Area: 6400,
        'Bounding box': '(0,0) (80,80)',
        Utilitization: 0.5,
        Margin: [4, 4],
        'Aspect ratio': 1,
      },
      'Max fanout': 20,
      'Target density': 0.3,
      'Target overflow': 0.1,
      'Global right padding': 0,
      'Cell padding x': 600,
      'Routability opt flag': 1,
      Clock: 'clk',
      'Frequency max [MHz]': 100,
      'Bottom layer': 'MET2',
      'Top layer': 'MET5',
    }))
    await Promise.resolve()

    expect(parameters.config.design).toBe('current-demo')
    expect(parameters.config.topModule).toBe('chip_top')
  })
})
