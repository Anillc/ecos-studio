import { waitForDesktopApi } from '@/platform/desktop'

export interface WaitForRuntimeReadyOptions {
  timeoutMs?: number
  pollIntervalMs?: number
}

export async function waitForRuntimeReady(
  options?: WaitForRuntimeReadyOptions,
): Promise<void> {
  await waitForDesktopApi({
    pollIntervalMs: options?.pollIntervalMs,
    timeoutMs: options?.timeoutMs,
  })
}
