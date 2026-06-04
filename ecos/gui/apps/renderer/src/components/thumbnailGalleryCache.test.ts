import { describe, expect, it } from 'vitest'

import { clearStepTabCache } from './thumbnailGalleryCache'

describe('thumbnailGalleryCache', () => {
  it('removes only tab info and errors for the selected step', () => {
    const tabInfoCache = {
      Floorplan_maps: { density: 'old-map' },
      Floorplan_analysis: { timing: 'old-report' },
      place_maps: { density: 'other-step' },
    }
    const tabErrorCache = {
      Floorplan_maps: 'old maps error',
      Floorplan_sta: 'old sta error',
      place_maps: 'keep me',
    }

    clearStepTabCache(tabInfoCache, tabErrorCache, 'Floorplan')

    expect(tabInfoCache).toEqual({
      place_maps: { density: 'other-step' },
    })
    expect(tabErrorCache).toEqual({
      place_maps: 'keep me',
    })
  })

  it('does nothing when there is no current step', () => {
    const tabInfoCache = {
      Floorplan_maps: { density: 'old-map' },
    }
    const tabErrorCache = {
      Floorplan_maps: 'old maps error',
    }

    clearStepTabCache(tabInfoCache, tabErrorCache, undefined)

    expect(tabInfoCache).toEqual({
      Floorplan_maps: { density: 'old-map' },
    })
    expect(tabErrorCache).toEqual({
      Floorplan_maps: 'old maps error',
    })
  })
})
