#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export function createDevEnvironment(env = process.env) {
  const next = { ...env }
  delete next.ELECTRON_RUN_AS_NODE
  return next
}

export function resolveElectronViteBin() {
  const scriptDir = dirname(fileURLToPath(import.meta.url))
  return resolve(scriptDir, '../node_modules/.bin/electron-vite')
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const child = spawn(resolveElectronViteBin(), ['dev'], {
    env: createDevEnvironment(),
    stdio: 'inherit',
  })

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal)
      return
    }
    process.exit(code ?? 0)
  })

  child.on('error', (error) => {
    console.error(error)
    process.exit(1)
  })
}
