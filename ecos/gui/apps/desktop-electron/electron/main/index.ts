import { app, BrowserWindow } from 'electron'
import { createMainWindow } from './createMainWindow'
import { registerIpc } from './registerIpc'

let ipcRegistered = false

async function launchMainWindow(): Promise<void> {
  if (!ipcRegistered) {
    registerIpc()
    ipcRegistered = true
  }

  await createMainWindow()
}

app.whenReady().then(() => {
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createMainWindow()
    }
  })

  void launchMainWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
