import { describe, expect, it, vi } from 'vitest'
import type { DesktopCommandResult } from '@ecos-studio/shared'
import { CommandBusService } from './commandBusService'

function result(overrides: Partial<DesktopCommandResult> = {}): DesktopCommandResult {
  return {
    cmd: 'run_step',
    data: {},
    message: [],
    ok: true,
    response: 'success',
    ...overrides,
  }
}

describe('CommandBusService', () => {
  it('rejects unknown command names', async () => {
    const service = new CommandBusService({
      adapter: { execute: vi.fn() },
    })

    await expect(service.execute({
      cmd: 'pwd',
      data: {},
      source: 'terminal',
    } as never)).resolves.toMatchObject({
      cmd: 'pwd',
      ok: false,
      response: 'error',
    })
  })

  it('emits started and completed events around successful commands', async () => {
    const listener = vi.fn()
    const adapter = {
      execute: vi.fn(async () => result({
        cmd: 'run_step',
        data: { state: 'Success' },
        message: ['ok'],
        ok: true,
        response: 'success',
      })),
    }
    const service = new CommandBusService({ adapter })
    service.onEvent(listener)

    await expect(service.execute({
      cmd: 'run_step',
      data: { step: 'place', rerun: false },
      source: 'button',
    })).resolves.toMatchObject({
      cmd: 'run_step',
      ok: true,
      response: 'success',
    })

    expect(listener).toHaveBeenNthCalledWith(1, expect.objectContaining({
      cmd: 'run_step',
      jobId: expect.any(String),
      type: 'started',
    }))
    expect(listener).toHaveBeenNthCalledWith(2, expect.objectContaining({
      cmd: 'run_step',
      jobId: expect.any(String),
      result: expect.objectContaining({ ok: true }),
      type: 'completed',
    }))
  })

  it('blocks overlapping long-running ECC commands in v1', async () => {
    let release!: () => void
    const service = new CommandBusService({
      adapter: {
        execute: vi.fn(() => new Promise<DesktopCommandResult>((resolve) => {
          release = () => resolve(result({
            cmd: 'rtl2gds',
            data: {},
            message: ['done'],
            ok: true,
            response: 'success',
          }))
        })),
      },
    })

    const first = service.execute({
      cmd: 'rtl2gds',
      data: { rerun: false },
      source: 'terminal',
    })
    const second = service.execute({
      cmd: 'run_step',
      data: { step: 'place', rerun: false },
      source: 'button',
    })

    await expect(second).resolves.toMatchObject({
      cmd: 'run_step',
      ok: false,
      response: 'warning',
    })
    release()
    await expect(first).resolves.toMatchObject({ ok: true })
  })

  it('emits failed events when the adapter throws', async () => {
    const listener = vi.fn()
    const service = new CommandBusService({
      adapter: {
        execute: vi.fn(async () => {
          throw new Error('adapter unavailable')
        }),
      },
    })
    service.onEvent(listener)

    await expect(service.execute({
      cmd: 'get_info',
      data: { step: 'place', id: 'layout' },
      source: 'terminal',
    })).resolves.toMatchObject({
      cmd: 'get_info',
      ok: false,
      response: 'error',
    })

    expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({
      cmd: 'get_info',
      result: expect.objectContaining({ ok: false }),
      type: 'failed',
    }))
  })
})
