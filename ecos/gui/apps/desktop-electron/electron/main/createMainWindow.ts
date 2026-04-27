import { BrowserWindow } from 'electron'
import { fileURLToPath } from 'node:url'

const preloadPath = fileURLToPath(new URL('../preload/index.mjs', import.meta.url))
const rendererIndexPath = fileURLToPath(new URL('../renderer/index.html', import.meta.url))

export async function createMainWindow(): Promise<BrowserWindow> {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1024,
    minHeight: 720,
    autoHideMenuBar: true,
    frame: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  const rendererUrl = process.env.ELECTRON_RENDERER_URL

  if (rendererUrl) {
    await mainWindow.loadURL(rendererUrl)
    return mainWindow
  }

  await mainWindow.loadFile(rendererIndexPath)
  return mainWindow
}
