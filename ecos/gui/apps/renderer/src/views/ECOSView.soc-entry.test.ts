import { describe, expect, it } from 'vitest'
import source from './ECOSView.vue?raw'

describe('ECOSView SoC entry card', () => {
  it('routes the SoC card to /soc instead of leaving it as coming-soon chrome', () => {
    expect(source).toContain("const navigateToSoC = () => router.push('/soc')")
    expect(source).toContain('@click="navigateToSoC"')
  })
})
