import { chmod, copyFile, mkdir, mkdtemp, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { execFile as execFileCallback } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

const execFile = promisify(execFileCallback)
const tempDirs: string[] = []

async function createWorkspace() {
  const rootDir = await mkdtemp(join(tmpdir(), 'ecos-prepare-resources-'))
  tempDirs.push(rootDir)

  const appDir = join(rootDir, 'ecos', 'gui', 'apps', 'desktop-electron')
  const scriptsDir = join(appDir, 'scripts')
  await mkdir(scriptsDir, { recursive: true })

  const sourceScript = fileURLToPath(new URL('./prepare-package-resources.sh', import.meta.url))
  const scriptPath = join(scriptsDir, 'prepare-package-resources.sh')
  await copyFile(sourceScript, scriptPath)
  await chmod(scriptPath, 0o755)

  return {
    appDir,
    resourcesDir: join(appDir, 'resources'),
    rootDir,
    scriptPath,
  }
}


async function createFakeEccRuntime(rootDir: string) {
  const bundleDir = join(rootDir, 'fake-ecc-cli-bundle')
  const artifactPath = join(rootDir, 'ecc.tar')
  await mkdir(join(bundleDir, '_internal'), { recursive: true })
  await writeFile(join(bundleDir, 'ecc'), '#!/usr/bin/env bash\n')
  await writeFile(join(bundleDir, '_internal', 'runtime-marker'), 'fake-runtime\n')
  await chmod(join(bundleDir, 'ecc'), 0o755)
  await execFile('tar', ['-cf', artifactPath, '-C', bundleDir, '.'])

  return artifactPath
}

afterEach(async () => {
  const { rm } = await import('node:fs/promises')
  await Promise.all(tempDirs.map((dir) => rm(dir, { force: true, recursive: true })))
  tempDirs.length = 0
})

describe('prepare-package-resources.sh', () => {
  it('resolves the local ECC CLI artifact when no override is provided', async () => {
    const workspace = await createWorkspace()
    const outputDir = join(workspace.rootDir, 'ecc', 'dist')
    const artifactPath = join(outputDir, 'ecc.tar')
    await mkdir(outputDir, { recursive: true })
    await writeFile(artifactPath, 'fake-tar')

    await expect(execFile('bash', [
      '-lc',
      `source "${workspace.scriptPath}"; resolve_ecc_cli_artifact`,
    ], {
      cwd: dirname(workspace.scriptPath),
      env: {
        ...process.env,
        ECOS_ECC_CLI_ARTIFACT: '',
      },
    })).resolves.toMatchObject({
      stdout: `${artifactPath}\n`,
    })
  })

  it('succeeds with only an ECC CLI artifact', async () => {
    const workspace = await createWorkspace()
    const eccRuntime = await createFakeEccRuntime(workspace.rootDir)

    await execFile(workspace.scriptPath, {
      cwd: dirname(workspace.scriptPath),
      env: {
        ...process.env,
        ECOS_ECC_CLI_ARTIFACT: eccRuntime,
      },
    })

    const wrapperPath = join(workspace.resourcesDir, 'binaries', 'ecc')
    const wrapper = await readFile(wrapperPath, 'utf8')

    await expect(stat(join(workspace.resourcesDir, 'oss-cad-suite'))).rejects.toBeTruthy()
    await expect(readdir(join(workspace.resourcesDir, 'binaries', 'ecc-runtime'))).resolves.toEqual(
      expect.arrayContaining(['_internal', 'ecc']),
    )
    await expect(stat(join(workspace.resourcesDir, 'binaries', 'ecc-runtime', 'ecc'))).resolves.toMatchObject({
      mode: expect.any(Number),
    })
    await expect(stat(wrapperPath)).resolves.toMatchObject({
      mode: expect.any(Number),
    })
    expect(wrapper).toContain('exec "$SCRIPT_DIR/ecc-runtime/ecc" "$@"')
  })

  it('ignores host OSS CAD env while preparing desktop resources', async () => {
    const workspace = await createWorkspace()
    const eccRuntime = await createFakeEccRuntime(workspace.rootDir)

    await execFile(workspace.scriptPath, {
      cwd: dirname(workspace.scriptPath),
      env: {
        ...process.env,
        CHIPCOMPILER_OSS_CAD_DIR: join(workspace.rootDir, 'missing-oss-cad-suite'),
        ECOS_OSS_CAD_BIN: join(workspace.rootDir, 'missing-oss-cad-suite', 'bin', 'yosys'),
        ECOS_ECC_CLI_ARTIFACT: eccRuntime,
      },
    })

    await expect(stat(join(workspace.resourcesDir, 'oss-cad-suite'))).rejects.toBeTruthy()
  })
})
