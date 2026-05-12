import { describe, expect, it } from 'vitest'
import source from './DrawingArea.vue?raw'

describe('DrawingArea loading state copy and reset', () => {
  it('uses English copy for missing layout JSON errors', () => {
    expect(source).toContain(
      'Layout JSON path was not found. Check that get_info(layout) returns a json or info field for the current step.',
    )
    expect(source).not.toContain('未找到布局 JSON 路径')
  })

  it('clears stale loading errors before handling a stage change', () => {
    expect(source).toContain('function resetLoadingState(): void')
    expect(source).toMatch(/const handleStageChange = async[\s\S]*?resetLoadingState\(\)/)
  })
})
