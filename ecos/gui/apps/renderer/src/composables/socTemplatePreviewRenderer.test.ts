import { describe, expect, it } from 'vitest'
import type { SocTemplateDetail } from './socTemplateMapper'
import { buildSocPreviewRects, formatSocBoundingBox } from './socTemplatePreviewRenderer'

const template = {
  id: 'demo',
  name: 'demo',
  info: 'No info provided',
  ioPinsCount: 0,
  coreCount: 1,
  sourceLabel: 'Fixed JSON',
  die: { llx: 0, lly: 0, urx: 100, ury: 100, width: 100, height: 100 },
  coreArea: { llx: 0, lly: 0, urx: 100, ury: 100, width: 100, height: 100 },
  cores: [
    { id: 1, name: 'core1', info: 'No info provided', align: 'left', orient: 'N', boundingBox: { llx: 10, lly: 60, urx: 30, ury: 80, width: 20, height: 20 } },
  ],
} satisfies SocTemplateDetail

describe('socTemplatePreviewRenderer', () => {
  it('projects core boxes into percentage-based preview rects', () => {
    expect(buildSocPreviewRects(template)).toEqual([
      expect.objectContaining({
        coreId: 1,
        label: 'core1',
        leftPct: 10,
        topPct: 20,
        widthPct: 20,
        heightPct: 20,
      }),
    ])
  })

  it('formats the bounding box line for the inspector', () => {
    expect(formatSocBoundingBox(template.cores[0]!.boundingBox)).toBe('10, 60, 30, 80')
  })
})
