import { describe, expect, it } from 'vitest'
import source from './DrawingArea.vue?raw'

describe('DrawingArea lifecycle guards', () => {
  it('captures workspace session identity before asynchronous stage loads mutate editor state', () => {
    expect(source).toContain('const { currentProject, resourceVersions, workspaceSession } = useWorkspace()')
    expect(source).toContain('function createDrawingAsyncGuard(')
    expect(source).toMatch(
      /const handleStageChange = async \(stage: string\) => \{[\s\S]*?const guard = createDrawingAsyncGuard\(stage\)[\s\S]*?const layoutResponse = await resolveWorkspaceStepInfoApi\(/,
    )
  })

  it('guards late DRC overlay reads against route, workspace, and editor changes', () => {
    expect(source).toContain(
      'guard: DrawingAsyncGuard = createDrawingAsyncGuard(currentStepKey.value)',
    )
    expect(source).toContain('const overlay = drcViolationOverlay')
    expect(source).toContain('if (!guard.isCurrent() || drcViolationOverlay !== overlay) return')
  })

  it('prevents stale tile-generation completions from loading into a newer workspace session', () => {
    expect(source).toMatch(
      /async function onGenerateTilesFromToolbar\(\): Promise<void> \{[\s\S]*?const guard = createDrawingAsyncGuard\(currentStepKey\.value\)[\s\S]*?const \{ baseUrl, outDir, fromCache \} = await runLayoutTileGenerationSingleFlight\([\s\S]*?if \(!guard\.isCurrent\(\)\) return[\s\S]*?await loadTileLayout\(baseUrl, outDir, guard\)/,
    )
  })
})
