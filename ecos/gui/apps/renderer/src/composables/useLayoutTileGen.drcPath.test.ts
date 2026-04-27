import { describe, it, expect } from 'vitest'
import {
  deriveDrcStepPathFromLayoutJsonRelative,
  resolveLayoutJsonAbsolutePath,
} from '@/composables/useLayoutTileGen'

describe('deriveDrcStepPathFromLayoutJsonRelative', () => {
  it('maps output/ layout dir to feature/drc.step.json', () => {
    expect(deriveDrcStepPathFromLayoutJsonRelative('templates/t18/drc_ecc/output/cell.json')).toBe(
      'templates/t18/drc_ecc/feature/drc.step.json',
    )
  })

  it('keeps same-dir drc when layout is already under feature/', () => {
    expect(deriveDrcStepPathFromLayoutJsonRelative('drc_ecc/feature/layout.json')).toBe(
      'drc_ecc/feature/drc.step.json',
    )
  })

  it('handles top-level output/', () => {
    expect(deriveDrcStepPathFromLayoutJsonRelative('output/foo.json')).toBe('feature/drc.step.json')
  })
})

describe('resolveLayoutJsonAbsolutePath', () => {
  it('joins and normalizes relative paths against the project root', async () => {
    await expect(
      resolveLayoutJsonAbsolutePath('/workspace/project', './home/tiles/../layout.json'),
    ).resolves.toBe('/workspace/project/home/layout.json')
  })

  it('repairs absolute home/Users paths that are missing the leading slash', async () => {
    await expect(
      resolveLayoutJsonAbsolutePath('/workspace/project', 'Users/alice/layout.json'),
    ).resolves.toBe('/Users/alice/layout.json')
  })

  it('preserves already-absolute Windows paths', async () => {
    await expect(
      resolveLayoutJsonAbsolutePath('/workspace/project', 'C:\\Layouts\\demo\\layout.json'),
    ).resolves.toBe('C:\\Layouts\\demo\\layout.json')
  })
})
