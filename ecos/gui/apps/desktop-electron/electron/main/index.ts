import { app, BrowserWindow } from 'electron'
import { createMainWindow } from './createMainWindow'
import { registerIpc } from './registerIpc'
import { registerApplicationMenu } from '../services/menuService'
import { bindWindowEvents } from '../services/windowService'

let ipcRegistered = false

async function launchMainWindow(): Promise<void> {
  if (!ipcRegistered) {
    registerIpc()
    ipcRegistered = true
  }

  const mainWindow = await createMainWindow()
  bindWindowEvents(mainWindow)
}

app.whenReady().then(() => {
  registerApplicationMenu()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void launchMainWindow()
    }
  })

  void launchMainWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
