export interface FlowLogSegmentLike {
  stepName: string
  tool: string
  state: string
  failed: boolean
  missing: boolean
  content: string
  live?: boolean
  truncated?: boolean
  totalSize?: number
  logPath?: string
}

export interface PlannedFlowLogTask<T extends FlowLogSegmentLike> {
  seg: T
  logPath: string
}

function flowLogSegmentKey(seg: Pick<FlowLogSegmentLike, 'stepName' | 'tool'>): string {
  return `${seg.stepName}\u001f${seg.tool}`
}

export function mergePlannedFlowLogSegments<T extends FlowLogSegmentLike>(
  tasks: readonly PlannedFlowLogTask<T>[],
  existingSegments: readonly T[],
): T[] {
  const existingByKey = new Map<string, T>()
  for (const segment of existingSegments) {
    existingByKey.set(flowLogSegmentKey(segment), segment)
  }

  return tasks.map(({ seg, logPath }) => {
    const prior = existingByKey.get(flowLogSegmentKey(seg))
    if (!prior) {
      return {
        ...seg,
        logPath,
      }
    }

    return {
      ...seg,
      content: prior.content,
      missing: prior.missing,
      truncated: prior.truncated,
      totalSize: prior.totalSize,
      logPath,
    }
  })
}
