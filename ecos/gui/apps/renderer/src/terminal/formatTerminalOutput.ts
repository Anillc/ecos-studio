import type { DesktopCommandResult } from '@ecos-studio/shared'

export const ECOS_TERMINAL_HELP = [
  'Available ECOS commands:',
  '  help',
  '  clear',
  '  ecos help',
  '  ecos run-all',
  '  ecos run-step <step>',
  '  ecos get-info <step> <id>',
  '  ecos home-page',
  '  ecos load-workspace <absolute-path>',
].join('\n')

export function formatTerminalResult(result: DesktopCommandResult): string {
  const prefix = result.ok ? 'ok' : result.response
  const messages = result.message.length > 0 ? result.message.join('\n') : `${result.cmd} ${prefix}`

  return `[${prefix}] ${messages}`
}
