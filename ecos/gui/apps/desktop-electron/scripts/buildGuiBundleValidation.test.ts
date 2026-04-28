import { chmod, mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { execFile as execFileCallback } from 'node:child_process'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it } from 'vitest'

const execFile = promisify(execFileCallback)
const tempDirs: string[] = []
const scriptPath = fileURLToPath(new URL('../../../../scripts/build-gui.sh', import.meta.url))

async function makeFakeRelease() {
  const rootDir = await mkdtemp(join(tmpdir(), 'ecos-build-gui-'))
  tempDirs.push(rootDir)

  const releaseDir = join(rootDir, 'release')
  const ossCadDir = join(releaseDir, 'linux-unpacked', 'resources', 'resources', 'oss-cad-suite')
  await mkdir(join(ossCadDir, 'bin'), { recursive: true })
  await mkdir(join(ossCadDir, 'share', 'yosys', 'plugins'), { recursive: true })

  return {
    ossCadDir,
    releaseDir,
    rootDir,
  }
}

afterEach(async () => {
  const { rm } = await import('node:fs/promises')
  await Promise.all(tempDirs.map((dir) => rm(dir, { force: true, recursive: true })))
  tempDirs.length = 0
})

describe('build-gui bundle validation', () => {
  it('fails when the packaged release is missing a usable OSS CAD suite', async () => {
    const { releaseDir } = await makeFakeRelease()

    await expect(execFile('bash', [
      '-lc',
      `source "${scriptPath}"; validate_packaged_oss_cad_suite "${releaseDir}"`,
    ])).rejects.toMatchObject({
      stderr: expect.stringContaining('packaged OSS CAD'),
    })
  })

  it('accepts a packaged OSS CAD suite when yosys and slang plugin are present and usable', async () => {
    const { ossCadDir, releaseDir } = await makeFakeRelease()
    const yosysPath = join(ossCadDir, 'bin', 'yosys')
    const slangPluginPath = join(ossCadDir, 'share', 'yosys', 'plugins', 'slang.so')

    await writeFile(yosysPath, `#!/usr/bin/env bash
set -euo pipefail
if [[ "$*" == *"-m slang"* ]]; then
  exit 0
fi
echo "unexpected yosys invocation: $*" >&2
exit 1
`)
    await chmod(yosysPath, 0o755)
    await writeFile(slangPluginPath, 'fake-slang-plugin')

    await expect(execFile('bash', [
      '-lc',
      `source "${scriptPath}"; validate_packaged_oss_cad_suite "${releaseDir}"`,
    ])).resolves.toMatchObject({
      stderr: '',
      stdout: '',
    })
  })
})
