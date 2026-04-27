import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getDesktopApi, hasDesktopApi } = vi.hoisted(() => ({
  getDesktopApi: vi.fn(),
  hasDesktopApi: vi.fn(),
}))

vi.mock('@/platform/desktop', () => ({
  getDesktopApi,
  hasDesktopApi,
}))

import { setDesktopWindowTitle } from './windowTitle'

describe('setDesktopWindowTitle', () => {
  beforeEach(() => {
    getDesktopApi.mockReset()
    hasDesktopApi.mockReset()
  })

  it('updates the title through the desktop bridge when available', async () => {
    const setTitle = vi.fn().mockResolvedValue(undefined)

    hasDesktopApi.mockReturnValue(true)
    getDesktopApi.mockReturnValue({
      window: {
        setTitle,
      },
    })

    await setDesktopWindowTitle('Project A')

    expect(setTitle).toHaveBeenCalledWith('Project A')
  })

  it('does nothing when the desktop bridge is unavailable', async () => {
    hasDesktopApi.mockReturnValue(false)

    await expect(setDesktopWindowTitle('Project B')).resolves.toBeUndefined()
    expect(getDesktopApi).not.toHaveBeenCalled()
  })
})
