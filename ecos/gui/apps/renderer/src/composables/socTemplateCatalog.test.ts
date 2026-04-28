import { describe, expect, it, vi } from 'vitest'
import {
  FIXED_SOC_TEMPLATE_ID,
  FIXED_SOC_TEMPLATE_URL,
  loadSocTemplateCatalog,
  loadSocTemplateDetail,
} from './socTemplateCatalog'

const responseJson = {
  design_name: 'ysyxSoCASIC',
  die: { llx: 0, lly: 0, urx: 100, ury: 100, width: 100, height: 100, area: 10000 },
  core: { llx: 10, lly: 10, urx: 90, ury: 90, width: 80, height: 80, area: 6400 },
  io_pins: { number: 58, list: [] },
  cores: { number: 0, list: [] },
}

describe('socTemplateCatalog', () => {
  it('loads the fixed public JSON and returns one gallery item', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => responseJson })
    const items = await loadSocTemplateCatalog(fetchMock)
    expect(fetchMock).toHaveBeenCalledWith(FIXED_SOC_TEMPLATE_URL)
    expect(items).toHaveLength(1)
    expect(items[0]?.id).toBe(FIXED_SOC_TEMPLATE_ID)
  })

  it('rejects unknown template ids before fetching', async () => {
    await expect(loadSocTemplateDetail('unknown-template', vi.fn() as any)).rejects.toThrow('Unknown SoC template: unknown-template')
  })

  it('keeps the fixed catalog id even if the source design name drifts', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ...responseJson, design_name: 'drifted-template-name' }),
    })

    await expect(loadSocTemplateDetail(FIXED_SOC_TEMPLATE_ID, fetchMock)).resolves.toMatchObject({
      id: FIXED_SOC_TEMPLATE_ID,
    })
  })

  it('throws when the fixed JSON request is not ok', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, json: async () => responseJson })

    await expect(loadSocTemplateDetail(FIXED_SOC_TEMPLATE_ID, fetchMock)).rejects.toThrow(
      `Unable to load SoC template data: ${FIXED_SOC_TEMPLATE_ID}`,
    )
  })
})
