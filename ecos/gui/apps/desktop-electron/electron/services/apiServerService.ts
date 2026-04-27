import { spawn, type ChildProcess } from 'node:child_process'
import { access } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { createServer, Socket } from 'node:net'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { app } from 'electron'

const API_HOST = '127.0.0.1'
const DEFAULT_API_PORT = 8765
const MAX_API_PORT = 8865
const API_READY_TIMEOUT_MS = 15_000
const API_HEALTH_TIMEOUT_MS = 2_000

type ServerOwnership = 'none' | 'owned' | 'external'

interface LaunchSpec {
  args: string[]
  command: string
  cwd: string
  env: NodeJS.ProcessEnv
}

interface ServerStartResult {
  ownership: Exclude<ServerOwnership, 'none'>
  port: number
  process: ChildProcess | null
}

interface HealthResponse {
  instance_token?: string
  status?: string
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function generateInstanceToken(port: number): string {
  const seed = `${process.pid}:${port}:${Date.now()}:${Math.random()}`
  return createHash('sha256').update(seed).digest('hex')
}

function candidatePorts(): number[] {
  return Array.from({ length: MAX_API_PORT - DEFAULT_API_PORT + 1 }, (_, index) =>
    DEFAULT_API_PORT + index,
  )
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function isPortAvailable(port: number): Promise<boolean> {
  return await new Promise<boolean>((resolve) => {
    const server = createServer()

    server.once('error', () => {
      resolve(false)
    })

    server.once('listening', () => {
      server.close(() => {
        resolve(true)
      })
    })

    server.listen(port, API_HOST)
  })
}

async function canConnectToPort(port: number, timeoutMs: number): Promise<boolean> {
  return await new Promise<boolean>((resolve) => {
    const socket = new Socket()

    const finish = (result: boolean) => {
      socket.removeAllListeners()
      socket.destroy()
      resolve(result)
    }

    socket.setTimeout(timeoutMs)
    socket.once('connect', () => finish(true))
    socket.once('timeout', () => finish(false))
    socket.once('error', () => finish(false))
    socket.connect(port, API_HOST)
  })
}

async function fetchHealthResponse(port: number, timeoutMs: number): Promise<HealthResponse | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => {
    controller.abort()
  }, timeoutMs)

  try {
    const response = await fetch(`http://${API_HOST}:${port}/health`, {
      method: 'GET',
      signal: controller.signal,
    })

    if (!response.ok) {
      return null
    }

    return (await response.json()) as HealthResponse
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

async function isApiServerHealthy(
  port: number,
  expectedToken?: string,
): Promise<boolean> {
  const json = await fetchHealthResponse(port, API_HEALTH_TIMEOUT_MS)

  if (!json || json.status !== 'ok') {
    return false
  }

  if (!expectedToken) {
    return true
  }

  return json.instance_token === expectedToken
}

function getServerDirectory(): string {
  return fileURLToPath(new URL('../../../../../server/', import.meta.url))
}

function getServerScriptPath(): string {
  return join(getServerDirectory(), 'run_server.py')
}

function getPythonInterpreterPath(): string {
  const serverDirectory = getServerDirectory()
  const venvPython =
    process.platform === 'win32'
      ? join(serverDirectory, '.venv', 'Scripts', 'python.exe')
      : join(serverDirectory, '.venv', 'bin', 'python3')

  return venvPython
}

function getBundledBinaryCandidates(): string[] {
  const extension = process.platform === 'win32' ? '.exe' : ''
  const archSpecificCandidates: string[] = []

  if (process.platform === 'linux' && process.arch === 'x64') {
    archSpecificCandidates.push(`api-server-x86_64-unknown-linux-gnu${extension}`)
  }
  if (process.platform === 'darwin' && process.arch === 'arm64') {
    archSpecificCandidates.push(`api-server-aarch64-apple-darwin${extension}`)
  }
  if (process.platform === 'darwin' && process.arch === 'x64') {
    archSpecificCandidates.push(`api-server-x86_64-apple-darwin${extension}`)
  }
  if (process.platform === 'win32' && process.arch === 'x64') {
    archSpecificCandidates.push(`api-server-x86_64-pc-windows-msvc${extension}`)
  }

  return [...archSpecificCandidates, `api-server${extension}`]
}

async function resolveLaunchSpec(port: number, token: string): Promise<LaunchSpec> {
  const serverDirectory = getServerDirectory()
  const serverScriptPath = getServerScriptPath()
  const venvPythonPath = getPythonInterpreterPath()

  if (!app.isPackaged || (await pathExists(serverScriptPath))) {
    const command = (await pathExists(venvPythonPath))
      ? venvPythonPath
      : process.platform === 'win32'
        ? 'python'
        : 'python3'
    const args = [
      serverScriptPath,
      '--host',
      API_HOST,
      '--port',
      String(port),
      '--disable-stdio-redirect',
    ]

    if (!app.isPackaged) {
      args.push('--reload', '--reload-dir', serverDirectory)
    }

    return {
      command,
      args,
      cwd: serverDirectory,
      env: {
        ...process.env,
        ECOS_SERVER_INSTANCE_TOKEN: token,
      },
    }
  }

  const binaryCandidates = getBundledBinaryCandidates()
  const searchDirectories = [
    dirname(process.execPath),
    join(dirname(process.execPath), 'binaries'),
    process.resourcesPath,
    join(process.resourcesPath, 'binaries'),
  ]

  for (const directory of searchDirectories) {
    for (const binaryName of binaryCandidates) {
      const binaryPath = join(directory, binaryName)

      if (!(await pathExists(binaryPath))) {
        continue
      }

      const resourcesDirectory = join(process.resourcesPath, 'resources', 'oss-cad-suite')
      const env: NodeJS.ProcessEnv = {
        ...process.env,
        ECOS_SERVER_INSTANCE_TOKEN: token,
      }

      if (await pathExists(resourcesDirectory)) {
        env.CHIPCOMPILER_OSS_CAD_DIR = resourcesDirectory
      }

      return {
        command: binaryPath,
        args: ['--host', API_HOST, '--port', String(port), '--disable-stdio-redirect'],
        cwd: dirname(binaryPath),
        env,
      }
    }
  }

  throw new Error('Unable to locate an API server launch target.')
}

type ReadyState =
  | { status: 'ready' }
  | { status: 'port-conflict' }
  | { message: string; status: 'failed' }

async function waitForServerReady(
  child: ChildProcess,
  port: number,
  expectedToken: string,
): Promise<ReadyState> {
  const startTime = Date.now()
  let delayMs = 100
  let spawnError: Error | null = null
  child.once('error', (error) => {
    spawnError = error
  })

  while (Date.now() - startTime < API_READY_TIMEOUT_MS) {
    if (spawnError) {
      return {
        status: 'failed',
        message: (spawnError as Error).message,
      }
    }

    if ((await canConnectToPort(port, 200)) && (await isApiServerHealthy(port, expectedToken))) {
      return { status: 'ready' }
    }

    if (child.exitCode !== null || child.signalCode !== null) {
      if (!(await isPortAvailable(port))) {
        return { status: 'port-conflict' }
      }

      return {
        status: 'failed',
        message: `server process exited before readiness with status ${child.exitCode ?? child.signalCode}`,
      }
    }

    await wait(delayMs)
    delayMs = Math.min(Math.floor((delayMs * 3) / 2), 1000)
  }

  if (child.exitCode !== null || child.signalCode !== null) {
    if (!(await isPortAvailable(port))) {
      return { status: 'port-conflict' }
    }

    return {
      status: 'failed',
      message: `server exited before readiness with status ${child.exitCode ?? child.signalCode}`,
    }
  }

  return {
    status: 'failed',
    message: `server did not become ready on port ${port} within ${API_READY_TIMEOUT_MS}ms`,
  }
}

export class ApiServerService {
  private currentPort = DEFAULT_API_PORT
  private ownedProcess: ChildProcess | null = null
  private ownership: ServerOwnership = 'none'
  private startupPromise: Promise<void> | null = null

  async start(): Promise<void> {
    if (this.ownership === 'external') {
      return
    }

    if (
      this.ownership === 'owned' &&
      this.ownedProcess &&
      this.ownedProcess.exitCode === null &&
      this.ownedProcess.signalCode === null
    ) {
      return
    }

    if (this.startupPromise) {
      return await this.startupPromise
    }

    this.startupPromise = this.startInternal()
      .catch((error) => {
        this.currentPort = DEFAULT_API_PORT
        this.ownedProcess = null
        this.ownership = 'none'
        console.warn('[desktop-electron] Failed to start API server:', error)
      })
      .finally(() => {
        this.startupPromise = null
      })

    await this.startupPromise
  }

  async getPort(): Promise<number> {
    if (this.startupPromise) {
      await this.startupPromise
    }

    return this.currentPort
  }

  async stop(): Promise<void> {
    if (this.ownership !== 'owned' || !this.ownedProcess) {
      return
    }

    const child = this.ownedProcess
    this.ownedProcess = null
    this.ownership = 'none'

    await stopOwnedProcess(child)
  }

  private async startInternal(): Promise<void> {
    const result = await this.startServer()
    this.currentPort = result.port
    this.ownership = result.ownership
    this.ownedProcess = result.process
  }

  private async startServer(): Promise<ServerStartResult> {
    if (
      !(await isPortAvailable(DEFAULT_API_PORT)) &&
      (await isApiServerHealthy(DEFAULT_API_PORT)) &&
      process.env.ECOS_REUSE_API_SERVER === '1'
    ) {
      return {
        ownership: 'external',
        port: DEFAULT_API_PORT,
        process: null,
      }
    }

    for (const port of candidatePorts()) {
      if (!(await isPortAvailable(port))) {
        continue
      }

      const token = generateInstanceToken(port)
      const launchSpec = await resolveLaunchSpec(port, token)
      const child = spawn(launchSpec.command, launchSpec.args, {
        cwd: launchSpec.cwd,
        detached: process.platform !== 'win32',
        env: launchSpec.env,
        stdio:
          app.isPackaged && !(process.stdout.isTTY || process.stderr.isTTY)
            ? 'ignore'
            : 'inherit',
      })

      const readyState = await waitForServerReady(child, port, token)

      if (readyState.status === 'ready') {
        return {
          ownership: 'owned',
          port,
          process: child,
        }
      }

      await stopOwnedProcess(child)

      if (readyState.status === 'port-conflict') {
        continue
      }

      throw new Error(readyState.message)
    }

    throw new Error(
      `Cannot start API server: no usable port found (tried ${DEFAULT_API_PORT} - ${MAX_API_PORT})`,
    )
  }
}

async function stopOwnedProcess(child: ChildProcess): Promise<void> {
  if (!child.pid) {
    return
  }

  if (process.platform === 'win32') {
    await new Promise<void>((resolve) => {
      const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
        stdio: 'ignore',
      })
      killer.once('exit', () => resolve())
      killer.once('error', () => {
        child.kill()
        resolve()
      })
    })
    return
  }

  try {
    process.kill(-child.pid, 'SIGTERM')
  } catch {
    child.kill('SIGTERM')
  }

  await wait(500)

  if (child.exitCode === null && child.signalCode === null) {
    try {
      process.kill(-child.pid, 'SIGKILL')
    } catch {
      child.kill('SIGKILL')
    }
  }
}

export { DEFAULT_API_PORT }
