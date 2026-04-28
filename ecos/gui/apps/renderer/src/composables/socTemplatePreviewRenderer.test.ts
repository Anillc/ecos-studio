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
  die: { llx: 0, lly: 0, urx: 300, ury: 300, width: 300, height: 300 },
  coreArea: { llx: 50, lly: 20, urx: 250, ury: 220, width: 200, height: 200 },
  cores: [
    { id: 1, name: 'u_GEN/u_GEN_1/core1', info: 'No info provided', align: 'left', orient: 'N', boundingBox: { llx: 70, lly: 140, urx: 110, ury: 180, width: 40, height: 40 } },
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

  it('returns stable zero percentages when the core area cannot be projected safely', () => {
    expect(buildSocPreviewRects({
      ...template,
      coreArea: { llx: 50, lly: 20, urx: 50, ury: 20, width: 0, height: 0 },
    })).toEqual([
      expect.objectContaining({
        coreId: 1,
        leftPct: 0,
        topPct: 0,
        widthPct: 0,
        heightPct: 0,
      }),
    ])
  })

  it('formats the bounding box line for the inspector', () => {
    expect(formatSocBoundingBox(template.cores[0]!.boundingBox)).toBe('70, 140, 110, 180')
  })
})
