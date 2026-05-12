import { describe, expect, it, vi } from 'vitest'

import { createElectronLogger } from './logger'

function createConsoleSink() {
  return {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  }
}

function stripAnsi(value: string): string {
  return value.replace(/\x1b\[[0-9;]*m/g, '')
}

describe('createElectronLogger', () => {
  it('colors terminal output when color mode is auto and the stream is a TTY', () => {
    const consoleSink = createConsoleSink()
    const logger = createElectronLogger({
      consoleSink,
      env: {
        ECOS_ELECTRON_LOG_LEVEL: 'info',
        ECOS_LOG_COLOR: 'auto',
      },
      isTty: true,
      now: () => new Date('2026-05-12T08:36:17.209Z'),
    })

    logger.warn('[tile] Missing layout JSON: /tmp/project/route.json')

    expect(consoleSink.warn).toHaveBeenCalledWith(
      expect.stringContaining('\x1b['),
    )
    expect(stripAnsi(consoleSink.warn.mock.calls[0]?.[0] ?? '')).toContain('16:36:17 WARN')
  })

  it('keeps terminal output plain when color is disabled or unavailable', () => {
    for (const env of [
      { ECOS_ELECTRON_LOG_LEVEL: 'info', ECOS_LOG_COLOR: 'never' },
      { ECOS_ELECTRON_LOG_LEVEL: 'info', NO_COLOR: '1' },
    ]) {
      const consoleSink = createConsoleSink()
      const logger = createElectronLogger({
        consoleSink,
        env,
        isTty: true,
        now: () => new Date('2026-05-12T08:36:17.209Z'),
      })

      logger.warn('[tile] Missing layout JSON: /tmp/project/route.json')

      expect(consoleSink.warn).toHaveBeenCalledWith(
        expect.not.stringContaining('\x1b['),
      )
    }

    const consoleSink = createConsoleSink()
    const logger = createElectronLogger({
      consoleSink,
      env: {
        ECOS_ELECTRON_LOG_LEVEL: 'info',
        ECOS_LOG_COLOR: 'auto',
      },
      isTty: false,
      now: () => new Date('2026-05-12T08:36:17.209Z'),
    })

    logger.warn('[tile] Missing layout JSON: /tmp/project/route.json')

    expect(consoleSink.warn).toHaveBeenCalledWith(
      expect.not.stringContaining('\x1b['),
    )
  })

  it('writes complete plain text records to the file sink', () => {
    const consoleSink = createConsoleSink()
    const fileSink = vi.fn()
    const logger = createElectronLogger({
      consoleSink,
      env: {
        ECOS_ELECTRON_LOG_LEVEL: 'error',
        ECOS_LOG_COLOR: 'always',
      },
      fileSink,
      isTty: true,
      now: () => new Date('2026-05-12T08:36:17.209Z'),
    })
    const error = new Error('missing layout')
    error.stack = 'Error: missing layout\n    at generateTiles'

    logger.debug('[tile] Preparing cache at %s', '/tmp/cache')
    logger.error('[tile] Tile generation failed', error)

    expect(consoleSink.debug).not.toHaveBeenCalled()
    expect(fileSink).toHaveBeenCalledWith(
      '2026-05-12T08:36:17.209Z DEBUG [tile] Preparing cache at /tmp/cache',
    )
    expect(fileSink).toHaveBeenCalledWith(
      expect.stringContaining('2026-05-12T08:36:17.209Z ERROR [tile] Tile generation failed Error: missing layout'),
    )
    expect(fileSink).toHaveBeenCalledWith(
      expect.stringContaining('Error: missing layout\n    at generateTiles'),
    )
    for (const call of fileSink.mock.calls) {
      expect(call[0]).not.toContain('\x1b[')
    }
  })

  it('logs status lines to the terminal even when the normal console level is warning', () => {
    const consoleSink = createConsoleSink()
    const logger = createElectronLogger({
      consoleSink,
      env: {},
      isTty: false,
      now: () => new Date('2026-05-12T08:36:17.209Z'),
    })

    logger.info('[api] Hidden by default')
    logger.status('[desktop] Logs: %s', '/tmp/ecos/main.log')

    expect(consoleSink.info).toHaveBeenCalledTimes(1)
    expect(consoleSink.info).toHaveBeenCalledWith(
      '16:36:17 INFO  [desktop] Logs: /tmp/ecos/main.log',
    )
  })
})
