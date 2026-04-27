import { beforeEach, describe, expect, it, vi } from 'vitest'

const { useMenuEvents } = vi.hoisted(() => ({
  useMenuEvents: vi.fn(),
}))

vi.mock('./useMenuEvents', () => ({
  useMenuEvents,
}))

import { useAppMenuActions } from './useAppMenuActions'

describe('useAppMenuActions', () => {
  beforeEach(() => {
    useMenuEvents.mockReset()
  })

  it('registers app-level native menu handlers that dispatch the real app actions', async () => {
    let registeredHandlers:
      | Partial<Record<'documentation' | 'new_project' | 'open_project', () => void>>
      | undefined

    useMenuEvents.mockImplementation((handlers) => {
      registeredHandlers = handlers
    })

    const showNewProjectWizard = vi.fn()
    const openProject = vi.fn().mockResolvedValue(true)
    const openDocumentation = vi.fn().mockResolvedValue(undefined)
    const navigateToWorkspace = vi.fn()

    const { handleMenuAction } = useAppMenuActions({
      navigateToWorkspace,
      openDocumentation,
      openProject,
      showNewProjectWizard,
    })

    expect(useMenuEvents).toHaveBeenCalledTimes(1)
    expect(registeredHandlers).toBeDefined()

    registeredHandlers?.new_project?.()
    await Promise.resolve()

    expect(showNewProjectWizard).toHaveBeenCalledTimes(1)

    registeredHandlers?.open_project?.()
    await Promise.resolve()

    expect(openProject).toHaveBeenCalledTimes(1)
    expect(navigateToWorkspace).toHaveBeenCalledTimes(1)

    registeredHandlers?.documentation?.()
    await Promise.resolve()

    expect(openDocumentation).toHaveBeenCalledTimes(1)

    await handleMenuAction('open-project')

    expect(openProject).toHaveBeenCalledTimes(2)
    expect(navigateToWorkspace).toHaveBeenCalledTimes(2)
  })

  it('does not navigate when opening a project is cancelled', async () => {
    useMenuEvents.mockImplementation(() => undefined)

    const navigateToWorkspace = vi.fn()
    const { handleMenuAction } = useAppMenuActions({
      navigateToWorkspace,
      openDocumentation: vi.fn().mockResolvedValue(undefined),
      openProject: vi.fn().mockResolvedValue(false),
      showNewProjectWizard: vi.fn(),
    })

    await handleMenuAction('open-project')

    expect(navigateToWorkspace).not.toHaveBeenCalled()
  })
})
