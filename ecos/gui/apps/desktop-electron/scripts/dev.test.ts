import { describe, expect, it } from 'vitest'
import { createDevEnvironment, resolveElectronViteBin } from './dev.mjs'

describe('desktop dev launcher', () => {
  it('removes ELECTRON_RUN_AS_NODE before launching electron-vite', () => {
    expect(createDevEnvironment({
      ELECTRON_RUN_AS_NODE: '1',
      PATH: '/bin',
    })).toEqual({
      PATH: '/bin',
    })
  })

  it('resolves the workspace electron-vite binary', () => {
    expect(resolveElectronViteBin()).toContain('node_modules/.bin/electron-vite')
  })
})
