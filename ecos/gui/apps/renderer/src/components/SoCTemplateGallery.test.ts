import { describe, expect, it } from 'vitest'
import source from './SoCTemplateGallery.vue?raw'

describe('SoCTemplateGallery', () => {
  it('exposes gallery items and emits back/open/retry events', () => {
    expect(source).toContain('items: SocTemplateSummary[]')
    expect(source).toContain("open: [templateId: string]")
    expect(source).toContain("back: []")
    expect(source).toContain("retry: []")
  })
})
