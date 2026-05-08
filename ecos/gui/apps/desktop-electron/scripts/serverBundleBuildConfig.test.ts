import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const repoRoot = fileURLToPath(new URL('../../../../../', import.meta.url))

describe('server bundle build configuration', () => {
  it('routes the GUI bundle through the onefile API server target', () => {
    const buildFile = readFileSync(`${repoRoot}ecos/BUILD.bazel`, 'utf8')

    expect(buildFile).toContain('name = "build_ecos_server"')
    expect(buildFile).toContain('--api-server-bin "$(location :build_ecos_server)"')
  })

  it('allows the PyInstaller spec to switch between onefile and onedir modes', () => {
    const specFile = readFileSync(`${repoRoot}ecos/server/ecos.spec`, 'utf8')

    expect(specFile).toContain('ECOS_PYINSTALLER_MODE')
    expect(specFile).toContain('COLLECT(')
  })
})
