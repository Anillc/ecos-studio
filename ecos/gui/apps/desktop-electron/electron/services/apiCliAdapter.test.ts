import { describe, expect, it, vi } from 'vitest'
import { ApiCliAdapter } from './apiCliAdapter'

describe('ApiCliAdapter', () => {
  it('maps run_step to the current FastAPI endpoint shape', async () => {
    const fetchMock = vi.fn(async () => ({
      json: async () => ({
        cmd: 'run_step',
        data: { state: 'Success', step: 'place' },
        message: ['done'],
        response: 'success',
      }),
      ok: true,
      status: 200,
    }))
    const adapter = new ApiCliAdapter({
      fetch: fetchMock as unknown as typeof fetch,
      portProvider: { getPort: vi.fn(async () => 9123) },
    })

    await expect(adapter.execute({
      cmd: 'run_step',
      data: { step: 'place', rerun: false },
      source: 'terminal',
    })).resolves.toEqual({
      cmd: 'run_step',
      data: { state: 'Success', step: 'place' },
      message: ['done'],
      ok: true,
      response: 'success',
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:9123/api/workspace/run_step',
      expect.objectContaining({
        body: JSON.stringify({
          cmd: 'run_step',
          data: { step: 'place', rerun: false },
        }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      }),
    )
  })

  it('normalizes failed API responses', async () => {
    const adapter = new ApiCliAdapter({
      fetch: vi.fn(async () => ({
        json: async () => ({
          cmd: 'rtl2gds',
          data: {},
          message: ['flow failed'],
          response: 'failed',
        }),
        ok: true,
        status: 200,
      })) as unknown as typeof fetch,
      portProvider: { getPort: vi.fn(async () => 9123) },
    })

    await expect(adapter.execute({
      cmd: 'rtl2gds',
      data: { rerun: false },
      source: 'button',
    })).resolves.toMatchObject({
      cmd: 'rtl2gds',
      message: ['flow failed'],
      ok: false,
      response: 'failed',
    })
  })

  it('normalizes network and HTTP errors', async () => {
    const adapter = new ApiCliAdapter({
      fetch: vi.fn(async () => ({
        json: async () => ({ detail: 'bad request' }),
        ok: false,
        status: 400,
      })) as unknown as typeof fetch,
      portProvider: { getPort: vi.fn(async () => 9123) },
    })

    await expect(adapter.execute({
      cmd: 'get_info',
      data: { step: 'place', id: 'layout' },
      source: 'terminal',
    })).resolves.toMatchObject({
      cmd: 'get_info',
      message: ['FastAPI request failed with HTTP 400.'],
      ok: false,
      response: 'error',
    })
  })
})
