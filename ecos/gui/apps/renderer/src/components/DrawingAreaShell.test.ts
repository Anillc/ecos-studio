import { describe, expect, it } from 'vitest'
import source from './DrawingAreaShell.vue?raw'

describe('DrawingAreaShell', () => {
  it('provides a slot-based generic host without importing the workspace editor stack', () => {
    expect(source).toContain('<slot />')
    expect(source).toContain('drawing-area-shell')
    expect(source).not.toContain("@/applications/editor")
  })
})
