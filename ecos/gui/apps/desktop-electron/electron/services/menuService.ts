import {
  BrowserWindow,
  Menu,
  app,
  type BrowserWindow as ElectronBrowserWindow,
  type MenuItemConstructorOptions,
} from 'electron'
import {
  desktopApiEventChannels,
  desktopMenuEventIds,
  type DesktopMenuEventId,
} from '@ecos-studio/shared'

type MenuTargetWindow = Pick<ElectronBrowserWindow, 'webContents'>

function getMenuTargetWindow(): MenuTargetWindow | undefined {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
}

function emitMenuAction(eventId: DesktopMenuEventId): void {
  getMenuTargetWindow()?.webContents.send(desktopApiEventChannels.menuAction, eventId)
}

function createMenuAction(
  label: string,
  eventId: DesktopMenuEventId,
  accelerator?: string,
): MenuItemConstructorOptions {
  return {
    accelerator,
    click: () => {
      emitMenuAction(eventId)
    },
    label,
  }
}

export function registerApplicationMenu(): void {
  const template: MenuItemConstructorOptions[] = []

  if (process.platform === 'darwin') {
    template.push({
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    })
  }

  template.push(
    {
      label: 'File',
      submenu: [
        createMenuAction('New Workspace', desktopMenuEventIds.newProject, 'CmdOrCtrl+N'),
        createMenuAction('Open Workspace', desktopMenuEventIds.openProject, 'CmdOrCtrl+O'),
      ],
    },
    {
      label: 'Help',
      submenu: [createMenuAction('Documentation', desktopMenuEventIds.documentation)],
    },
  )

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}
