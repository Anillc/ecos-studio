import { beforeEach, describe, expect, it, vi } from 'vitest'
import { StateEnum, StepEnum } from '@/api/type'

const {
  ensureTauri,
  showToast,
  runStepApi,
  rtl2gdsApi,
} = vi.hoisted(() => ({
  ensureTauri: vi.fn(() => false),
  showToast: vi.fn(),
  runStepApi: vi.fn(),
  rtl2gdsApi: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({
    params: {
      step: StepEnum.FLOORPLAN,
    },
  }),
}))

vi.mock('./useTauri', () => ({
  useTauri: () => ({
    isInTauri: false,
    ensureTauri,
  }),
}))

vi.mock('./useWorkspace', () => ({
  useWorkspace: () => ({
    showToast,
  }),
}))

vi.mock('@/api/flow', () => ({
  runStepApi,
  rtl2gdsApi,
}))

import { flowExecutionActive, useFlowRunner } from './useFlowRunner'

describe('useFlowRunner desktop-only guard', () => {
  beforeEach(() => {
    ensureTauri.mockReset()
    ensureTauri.mockReturnValue(false)
    showToast.mockReset()
    runStepApi.mockReset()
    rtl2gdsApi.mockReset()
    flowExecutionActive.value = false
  })

  it('shows a toast when running a single step outside the desktop runtime', async () => {
    const { runFlow } = useFlowRunner()

    const result = await runFlow()

    expect(ensureTauri).toHaveBeenCalled()
    expect(showToast).toHaveBeenCalledWith({
      severity: 'warn',
      summary: 'Desktop App Required',
      detail: 'Flow execution is only available in the desktop app.',
      life: 5000,
    })
    expect(runStepApi).not.toHaveBeenCalled()
    expect(result).toEqual({
      step: StepEnum.FLOORPLAN,
      state: StateEnum.Invalid,
    })
  })

  it('shows a toast when running the full flow outside the desktop runtime', async () => {
    const { runAllFlow } = useFlowRunner()

    const result = await runAllFlow()

    expect(ensureTauri).toHaveBeenCalled()
    expect(showToast).toHaveBeenCalledWith({
      severity: 'warn',
      summary: 'Desktop App Required',
      detail: 'Flow execution is only available in the desktop app.',
      life: 5000,
    })
    expect(rtl2gdsApi).not.toHaveBeenCalled()
    expect(result).toBeNull()
  })
})
