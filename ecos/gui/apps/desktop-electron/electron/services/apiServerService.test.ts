import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  FakeChildProcess,
  access,
  createHash,
  createServer,
  electronApp,
  portAvailabilityQueue,
  socketConnectQueue,
  spawn,
} = vi.hoisted(() => {
  class FakeChildProcess {
    private listeners = new Map<string, (...args: unknown[]) => void>()
    pid: number | undefined
    exitCode: number | null = null
    signalCode: NodeJS.Signals | null = null
    kill = vi.fn((signal?: NodeJS.Signals) => {
      this.signalCode = signal ?? 'SIGTERM'
      return true
    })

    constructor(pid?: number) {
      this.pid = pid
    }

    once(eventName: string, listener: (...args: unknown[]) => void) {
      this.listeners.set(eventName, listener)
      return this
    }

    emit(eventName: string, ...args: unknown[]) {
      this.listeners.get(eventName)?.(...args)
      return true
    }
  }

  const portAvailabilityQueue: boolean[] = []
  const socketConnectQueue: boolean[] = []
  const access = vi.fn()
  const spawn = vi.fn()
  const electronApp = {
    isPackaged: false,
  }
  const createHash = vi.fn(() => {
    const hash = {
      digest: vi.fn(() => 'deterministic-token'),
      update: vi.fn(() => hash),
    }

    return hash
  })
  const createServer = vi.fn(() => {
    let errorListener: ((error: Error) => void) | undefined
    let listeningListener: (() => void) | undefined

    const fakeServer = {
      close: (callback?: () => void) => {
        callback?.()
      },
      listen: () => {
        const isAvailable = portAvailabilityQueue.shift() ?? true

        if (isAvailable) {
          listeningListener?.()
          return
        }

        errorListener?.(new Error('EADDRINUSE'))
      },
      once: (eventName: string, listener: (...args: unknown[]) => void) => {
        if (eventName === 'error') {
          errorListener = listener as (error: Error) => void
        }
        if (eventName === 'listening') {
          listeningListener = listener as () => void
        }

        return fakeServer
      },
    }

    return fakeServer
  })

  return {
    FakeChildProcess,
    access,
    createHash,
    createServer,
    electronApp,
    portAvailabilityQueue,
    socketConnectQueue,
    spawn,
  }
})

vi.mock('electron', () => ({
  app: electronApp,
}))

vi.mock('node:fs/promises', () => ({
  access,
}))

vi.mock('node:child_process', () => ({
  spawn,
}))

vi.mock('node:crypto', () => ({
  createHash,
}))

vi.mock('node:net', () => ({
  Socket: class FakeSocket {
    private listeners: Record<string, ((...args: unknown[]) => void) | undefined> = {}

    setTimeout() {
      return this
    }

    once(eventName: string, listener: (...args: unknown[]) => void) {
      this.listeners[eventName] = listener
      return this
    }

    connect() {
      const shouldConnect = socketConnectQueue.shift() ?? false

      if (shouldConnect) {
        this.listeners.connect?.()
      } else {
        this.listeners.error?.(new Error('ECONNREFUSED'))
      }

      return this
    }

    removeAllListeners() {
      this.listeners = {}
      return this
    }

    destroy() {
      return this
    }
  },
  createServer,
}))

import { ApiServerService } from './apiServerService'

describe('ApiServerService', () => {
  const originalFetch = globalThis.fetch
  const originalReuseFlag = process.env.ECOS_REUSE_API_SERVER
  let processKillSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    access.mockReset()
    createHash.mockClear()
    createServer.mockClear()
    spawn.mockReset()
    portAvailabilityQueue.splice(0)
    socketConnectQueue.splice(0)
    electronApp.isPackaged = false
    process.env.ECOS_REUSE_API_SERVER = ''
    globalThis.fetch = vi.fn()
    processKillSpy = vi.spyOn(process, 'kill').mockImplementation(() => true)
  })

  afterEach(() => {
    if (originalFetch) {
      globalThis.fetch = originalFetch
    } else {
      delete (globalThis as { fetch?: typeof fetch }).fetch
    }

    if (originalReuseFlag == null) {
      delete process.env.ECOS_REUSE_API_SERVER
    } else {
      process.env.ECOS_REUSE_API_SERVER = originalReuseFlag
    }

    processKillSpy.mockRestore()
    vi.useRealTimers()
  })

  it('reuses a healthy external server on 127.0.0.1:8765 only when ECOS_REUSE_API_SERVER=1', async () => {
    process.env.ECOS_REUSE_API_SERVER = '1'
    portAvailabilityQueue.push(false)
    ;(globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: async () => ({ status: 'ok' }),
      ok: true,
    })

    const service = new ApiServerService()

    await expect(service.start()).resolves.toBeUndefined()
    await expect(service.getPort()).resolves.toBe(8765)
    expect(spawn).not.toHaveBeenCalled()
  })

  it('surfaces startup failures instead of swallowing them', async () => {
    portAvailabilityQueue.push(true, true)
    access.mockRejectedValue(new Error('missing venv'))
    spawn.mockImplementation(() => {
      throw new Error('spawn failed')
    })

    const service = new ApiServerService()

    await expect(service.start()).rejects.toThrow('spawn failed')
    await expect(service.getPort()).rejects.toThrow('spawn failed')
  })

  it('stops an owned child process on shutdown', async () => {
    vi.useFakeTimers()
    portAvailabilityQueue.push(true, true)
    access.mockRejectedValue(new Error('missing venv'))
    socketConnectQueue.push(true)
    ;(globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: async () => ({
        instance_token: 'deterministic-token',
        status: 'ok',
      }),
      ok: true,
    })

    const ownedChild = new FakeChildProcess(4321)
    spawn.mockReturnValue(ownedChild)

    const service = new ApiServerService()

    await service.start()

    processKillSpy.mockImplementation((pid: number, signal?: NodeJS.Signals | number) => {
      if (pid === -4321 && signal === 'SIGTERM') {
        ownedChild.signalCode = 'SIGTERM'
      }

      return true
    })

    const stopPromise = service.stop()
    await vi.advanceTimersByTimeAsync(500)
    await stopPromise

    expect(processKillSpy).toHaveBeenCalledWith(-4321, 'SIGTERM')
  })
})
