type LogLevelName = 'debug' | 'info' | 'warning' | 'error' | 'critical'

const LOG_LEVELS: Record<LogLevelName, number> = {
  debug: 10,
  info: 20,
  warning: 30,
  error: 40,
  critical: 50,
}

function readLogLevel(): number {
  const rawLevel = process.env.ECOS_ELECTRON_LOG_LEVEL?.trim().toLowerCase()
  if (!rawLevel) {
    return LOG_LEVELS.warning
  }

  if (rawLevel === 'warn') {
    return LOG_LEVELS.warning
  }

  return LOG_LEVELS[rawLevel as LogLevelName] ?? LOG_LEVELS.warning
}

function shouldLog(level: LogLevelName): boolean {
  return LOG_LEVELS[level] >= readLogLevel()
}

export const electronLogger = {
  debug(message: string, ...args: unknown[]): void {
    if (shouldLog('debug')) {
      console.debug(message, ...args)
    }
  },

  error(message: string, ...args: unknown[]): void {
    if (shouldLog('error')) {
      console.error(message, ...args)
    }
  },

  info(message: string, ...args: unknown[]): void {
    if (shouldLog('info')) {
      console.info(message, ...args)
    }
  },

  warn(message: string, ...args: unknown[]): void {
    if (shouldLog('warning')) {
      console.warn(message, ...args)
    }
  },
}
