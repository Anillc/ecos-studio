import { useMenuEvents } from './useMenuEvents'

export type AppMenuAction = 'about' | 'documentation' | 'new-project' | 'open-project'

interface AppMenuActionDependencies {
  navigateToWorkspace(): void
  openDocumentation(): Promise<void>
  openProject(): Promise<boolean | undefined>
  showNewProjectWizard(): void
}

export function useAppMenuActions({
  navigateToWorkspace,
  openDocumentation,
  openProject,
  showNewProjectWizard,
}: AppMenuActionDependencies) {
  const handleMenuAction = async (action: AppMenuAction | string) => {
    switch (action) {
      case 'new-project':
        showNewProjectWizard()
        break
      case 'open-project':
        if (await openProject()) {
          navigateToWorkspace()
        }
        break
      case 'documentation':
        await openDocumentation()
        break
      case 'about':
      default:
        break
    }
  }

  useMenuEvents({
    documentation: () => {
      void handleMenuAction('documentation')
    },
    new_project: () => {
      void handleMenuAction('new-project')
    },
    open_project: () => {
      void handleMenuAction('open-project')
    },
  })

  return {
    handleMenuAction,
  }
}
