import { describe, expect, it } from 'vitest'
import source from './SoCTemplateGalleryView.vue?raw'

describe('SoCTemplateGalleryView', () => {
  it('loads the fixed catalog and routes into the detail page', () => {
    expect(source).toContain('loadSocTemplateCatalog')
    expect(source).toContain("router.push({ name: 'SoCTemplateDetail'")
    expect(source).toContain('<SoCTemplateGallery')
  })
})
