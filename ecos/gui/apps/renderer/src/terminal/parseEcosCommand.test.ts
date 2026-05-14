import { describe, expect, it } from 'vitest'
import { parseEcosCommand } from './parseEcosCommand'

describe('parseEcosCommand', () => {
  it('parses help commands without calling Electron for shell syntax', () => {
    expect(parseEcosCommand('help')).toEqual({ kind: 'local', action: 'help' })
    expect(parseEcosCommand('ecos help')).toEqual({ kind: 'local', action: 'help' })
  })

  it('parses clear commands locally', () => {
    expect(parseEcosCommand('clear')).toEqual({ kind: 'local', action: 'clear' })
  })

  it('parses empty input as a no-op', () => {
    expect(parseEcosCommand('   ')).toEqual({ kind: 'empty' })
  })

  it('maps run-all to rtl2gds', () => {
    expect(parseEcosCommand('ecos run-all')).toEqual({
      kind: 'command',
      request: {
        cmd: 'rtl2gds',
        data: { rerun: false },
        source: 'terminal',
      },
    })
  })

  it('maps run-step to run_step with rerun disabled', () => {
    expect(parseEcosCommand('ecos run-step place')).toEqual({
      kind: 'command',
      request: {
        cmd: 'run_step',
        data: { step: 'place', rerun: false },
        source: 'terminal',
      },
    })
  })

  it('maps get-info to get_info with step and id', () => {
    expect(parseEcosCommand('ecos get-info place layout')).toEqual({
      kind: 'command',
      request: {
        cmd: 'get_info',
        data: { step: 'place', id: 'layout' },
        source: 'terminal',
      },
    })
  })

  it('maps home-page and load-workspace', () => {
    expect(parseEcosCommand('ecos home-page')).toEqual({
      kind: 'command',
      request: {
        cmd: 'home_page',
        data: {},
        source: 'terminal',
      },
    })
    expect(parseEcosCommand('ecos load-workspace /tmp/ecos-demo')).toEqual({
      kind: 'command',
      request: {
        cmd: 'load_workspace',
        data: { directory: '/tmp/ecos-demo' },
        source: 'terminal',
      },
    })
  })

  it('rejects unknown commands without creating a desktop request', () => {
    expect(parseEcosCommand('ecos pwd')).toEqual({
      kind: 'error',
      message: expect.stringContaining('Unknown ECOS command'),
    })
  })
})
