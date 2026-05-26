export function clearStepTabCache(
  tabInfoCache: Record<string, Record<string, unknown>>,
  tabErrorCache: Record<string, string | null>,
  step: string | undefined,
): void {
  if (!step) return

  for (const key of Object.keys(tabInfoCache).filter(k => k.startsWith(`${step}_`))) {
    delete tabInfoCache[key]
  }

  for (const key of Object.keys(tabErrorCache).filter(k => k.startsWith(`${step}_`))) {
    delete tabErrorCache[key]
  }
}
