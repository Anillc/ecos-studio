import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { createMainWindow } from './createMainWindow'
import { registerIpc } from './registerIpc'
import { ApiServerService } from '../services/apiServerService'
import { registerApplicationMenu } from '../services/menuService'
import { ProjectScopeService } from '../services/projectScopeService'
import { SettingsStore } from '../services/settingsStore'
import { TileService } from '../services/tileService'
import { bindWindowEvents } from '../services/windowService'
import { WorkspaceService } from '../services/workspaceService'

let ipcRegistered = false
let isShuttingDown = false
let services:
  | {
      apiServerService: ApiServerService
      settingsStore: SettingsStore
      tileService: TileService
      workspaceService: WorkspaceService
    }
  | null = null

function isEnabledEnv(name: string): boolean {
  const value = process.env[name]?.trim().toLowerCase()
  return value === '1' || value === 'true'
}

if (isEnabledEnv('ECOS_ELECTRON_DISABLE_GPU')) {
  app.commandLine.appendSwitch('disable-gpu')
  app.commandLine.appendSwitch('disable-gpu-compositing')
  app.commandLine.appendSwitch('disable-gpu-process-crash-limit')
  app.commandLine.appendSwitch('in-process-gpu')
  app.commandLine.appendSwitch('enable-unsafe-swiftshader')
  app.commandLine.appendSwitch('use-angle', 'swiftshader')
  app.commandLine.appendSwitch('use-gl', 'swiftshader')
  app.disableHardwareAcceleration()
}

function getDesktopServices() {
  if (services) {
    return services
  }

  const settingsStore = new SettingsStore({
    filePath: join(app.getPath('userData'), 'settings.json'),
  })
  const projectScopeService = new ProjectScopeService()
  const apiServerService = new ApiServerService()
  const workspaceService = new WorkspaceService({
    apiPortProvider: apiServerService,
    projectScopeProvider: projectScopeService,
  })
  const tileService = new TileService({
    projectRootProvider: projectScopeService,
  })

  services = {
    apiServerService,
    settingsStore,
    tileService,
    workspaceService,
  }

  return services
}

async function launchMainWindow(): Promise<void> {
  const desktopServices = getDesktopServices()

  if (!ipcRegistered) {
    registerIpc(undefined, {
      settingsStore: desktopServices.settingsStore,
      tileService: desktopServices.tileService,
      workspaceService: desktopServices.workspaceService,
    })
    ipcRegistered = true
  }

  await desktopServices.apiServerService.start()

  const mainWindow = await createMainWindow()
  bindWindowEvents(mainWindow)
}

function handleLaunchError(error: unknown): void {
  console.error('[desktop-electron] Failed to launch main window:', error)
  app.quit()
}

app.whenReady().then(() => {
  registerApplicationMenu()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void launchMainWindow().catch(handleLaunchError)
    }
  })

  void launchMainWindow().catch(handleLaunchError)
})

app.on('before-quit', (event) => {
  if (isShuttingDown) {
    return
  }

  event.preventDefault()
  isShuttingDown = true

  void (services?.apiServerService.stop() ?? Promise.resolve()).finally(() => {
    app.exit(0)
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
