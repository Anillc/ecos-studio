import { describe, expect, it } from 'vitest'
import routerSource from './index.ts?raw'

describe('router SoC welcome routes', () => {
  it('registers the SoC gallery and detail routes under the welcome shell', () => {
    expect(routerSource).toContain("{ path: 'soc', name: 'SoCGallery'")
    expect(routerSource).toContain("{ path: 'soc/:templateId', name: 'SoCTemplateDetail'")
    expect(routerSource).toContain("component: () => import('../views/SoCTemplateGalleryView.vue')")
    expect(routerSource).toContain("component: () => import('../views/SoCTemplateDetailView.vue')")
    expect(routerSource).toContain('props: true')
  })
})
