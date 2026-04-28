import { describe, expect, it } from 'vitest'
import useHomeDataSource from './useHomeData.ts?raw'

describe('useHomeData flow log loading strategy', () => {
  it('exposes an on-demand step log loader instead of bulk hydrating all contents on initial load', () => {
    expect(useHomeDataSource).toContain('ensureFlowLogSegmentContentLoaded')
    expect(useHomeDataSource).not.toContain('await hydrateSegmentsWithLogs(flowLogSegments')
  })
})
