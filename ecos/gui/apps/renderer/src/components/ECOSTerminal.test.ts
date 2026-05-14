import { describe, expect, it } from 'vitest'
import terminalSource from './ECOSTerminal.vue?raw'

describe('ECOSTerminal', () => {
  it('uses xterm with fit, web links, and search addons', () => {
    expect(terminalSource).toContain("from '@xterm/xterm'")
    expect(terminalSource).toContain("from '@xterm/addon-fit'")
    expect(terminalSource).toContain("from '@xterm/addon-web-links'")
    expect(terminalSource).toContain("from '@xterm/addon-search'")
  })

  it('starts as a node-pty shell terminal', () => {
    expect(terminalSource).toContain('startShellSession')
    expect(terminalSource).toContain("desktopApi.shell.createSession")
    expect(terminalSource).toContain("desktopApi.shell.write")
    expect(terminalSource).toContain("desktopApi.shell.resize")
    expect(terminalSource).toContain("desktopApi.shell.kill")
    expect(terminalSource).toContain("desktopApi.shell.onData")
    expect(terminalSource).toContain("desktopApi.shell.onExit")
    expect(terminalSource).not.toContain('desktopApi.cli.execute')
  })

  it('does not expose a terminal mode toggle', () => {
    expect(terminalSource).not.toContain('terminalMode')
    expect(terminalSource).not.toContain('terminal-mode-toggle')
    expect(terminalSource).not.toContain('switchTerminalMode')
  })

  it('starts the shell when the terminal is first expanded', () => {
    expect(terminalSource).toMatch(
      /watch\(\s*\(\) => props\.expanded,[\s\S]*if \(expanded\) \{[\s\S]*await startShellSession\(\)/,
    )
  })

  it('overlays the app content instead of taking flex layout space', () => {
    expect(terminalSource).toMatch(/\.ecos-terminal-panel\s*\{[\s\S]*position:\s*absolute;/)
    expect(terminalSource).toMatch(/\.ecos-terminal-panel\s*\{[\s\S]*z-index:\s*\d+;/)
    expect(terminalSource).toMatch(/\.ecos-terminal-panel\s*\{[\s\S]*bottom:\s*24px;/)
    expect(terminalSource).not.toContain('flex: 0 0 260px')
  })

  it('forwards all terminal input directly to the active shell session', () => {
    expect(terminalSource).toMatch(
      /function handleData\(data: string\) \{[\s\S]*void desktopApi\.shell\.write\(shellSessionId, data\)[\s\S]*\}/,
    )
  })
})
