import type { DesktopCommandRequest } from '@ecos-studio/shared'

export type ParsedEcosCommand =
  | { kind: 'empty' }
  | { action: 'clear' | 'help'; kind: 'local' }
  | { kind: 'command'; request: DesktopCommandRequest }
  | { kind: 'error'; message: string }

function splitCommand(input: string): string[] {
  return input.trim().split(/\s+/).filter(Boolean)
}

function commandRequest(
  cmd: DesktopCommandRequest['cmd'],
  data: Record<string, unknown> = {},
): ParsedEcosCommand {
  return {
    kind: 'command',
    request: {
      cmd,
      data,
      source: 'terminal',
    },
  }
}

function unknownCommand(input: string): ParsedEcosCommand {
  return {
    kind: 'error',
    message: `Unknown ECOS command: ${input}. Type "help" for available commands.`,
  }
}

export function parseEcosCommand(input: string): ParsedEcosCommand {
  const trimmed = input.trim()

  if (!trimmed) {
    return { kind: 'empty' }
  }

  const parts = splitCommand(trimmed)
  const commandParts = parts[0] === 'ecos' ? parts.slice(1) : parts
  const [verb, ...args] = commandParts

  if (!verb || verb === 'help') {
    return { action: 'help', kind: 'local' }
  }

  if (parts[0] !== 'ecos' && verb !== 'clear' && verb !== 'help') {
    return unknownCommand(trimmed)
  }

  switch (verb) {
    case 'clear':
      return { action: 'clear', kind: 'local' }
    case 'run-all':
      return commandRequest('rtl2gds', { rerun: false })
    case 'run-step':
      return args[0]
        ? commandRequest('run_step', { rerun: false, step: args[0] })
        : {
            kind: 'error',
            message: 'Missing step name. Use: ecos run-step <step>',
          }
    case 'get-info':
      return args[0] && args[1]
        ? commandRequest('get_info', { id: args[1], step: args[0] })
        : {
            kind: 'error',
            message: 'Missing get-info arguments. Use: ecos get-info <step> <id>',
          }
    case 'home-page':
      return commandRequest('home_page')
    case 'load-workspace':
      return args[0]
        ? commandRequest('load_workspace', { directory: args.join(' ') })
        : {
            kind: 'error',
            message: 'Missing workspace path. Use: ecos load-workspace <absolute-path>',
          }
    default:
      return unknownCommand(trimmed)
  }
}
