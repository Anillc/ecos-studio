import { describe, expect, it, vi } from 'vitest'
import galleryViewSource from '../views/SoCTemplateGalleryView.vue?raw'
import detailViewSource from '../views/SoCTemplateDetailView.vue?raw'

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return {
    ...actual,
    createWebHashHistory: actual.createMemoryHistory
  }
})

import router from './index'

describe('router SoC welcome routes', () => {
  it('registers the SoC gallery and detail routes under the welcome shell', async () => {
    const galleryRoute = router.resolve('/soc')
    expect(galleryRoute.name).toBe('SoCGallery')
    expect(galleryRoute.matched.map((record) => record.path)).toEqual(['/', '/soc'])

    const detailRoute = router.resolve('/soc/retro-template')
    expect(detailRoute.name).toBe('SoCTemplateDetail')
    expect(detailRoute.params).toEqual({ templateId: 'retro-template' })
    expect(detailRoute.matched.map((record) => record.path)).toEqual(['/', '/soc/:templateId'])

    const galleryRecord = router.getRoutes().find((record) => record.name === 'SoCGallery')
    const detailRecord = router.getRoutes().find((record) => record.name === 'SoCTemplateDetail')

    expect(galleryRecord?.components?.default).toBeTypeOf('function')
    expect(detailRecord?.components?.default).toBeTypeOf('function')
    expect(detailRecord?.props).toEqual({ default: true })
    expect(galleryViewSource).toContain('SoC Templates')
    expect(detailViewSource).toContain('defineProps')
  })
})
