import { describe, expect, it } from 'vitest'
import source from './SoCTemplatePreviewCanvas.vue?raw'

describe('SoCTemplatePreviewCanvas', () => {
  it('accepts template data, tracks the selected core, and emits select-core', () => {
    expect(source).toContain('selectedCoreId: number | null')
    expect(source).toContain("select-core: [coreId: number]")
    expect(source).toContain('buildSocPreviewRects')
    expect(source).toContain('data-soc-core-id')
  })
})
