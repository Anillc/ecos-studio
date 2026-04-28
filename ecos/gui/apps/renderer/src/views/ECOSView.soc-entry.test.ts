import { describe, expect, it } from 'vitest'
import source from './ECOSView.vue?raw'

describe('ECOSView SoC entry card', () => {
  it('renders the SoC entry as an active button to /soc', () => {
    expect(source).toContain("const navigateToSoC = () => router.push('/soc')")
    expect(source).toContain('<!-- SOC -->\n          <button type="button" @click="navigateToSoC"')
    expect(source).toContain('<span class="text-sm font-medium text-(--text-primary) mb-1">SoC</span>')
    expect(source).not.toContain('<!-- SOC -->\n          <div')
    expect(source).not.toMatch(/<!-- SOC -->[\s\S]*Coming Soon[\s\S]*<\/button>/)
  })
})
