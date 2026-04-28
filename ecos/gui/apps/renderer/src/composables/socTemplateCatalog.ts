import {
  normalizeSocTemplateDetail,
  toSocTemplateSummary,
  type SocTemplateDetail,
  type SocTemplateSummary,
} from './socTemplateMapper'

export const FIXED_SOC_TEMPLATE_ID = 'ysyxSoCASIC'
export const FIXED_SOC_TEMPLATE_URL = '/ysyxSoCASIC.json'

type FetchLike = (input: string) => Promise<{ ok: boolean; json(): Promise<unknown> }>

export async function loadSocTemplateDetail(templateId: string, fetchImpl: FetchLike = fetch as FetchLike): Promise<SocTemplateDetail> {
  if (templateId !== FIXED_SOC_TEMPLATE_ID) {
    throw new Error(`Unknown SoC template: ${templateId}`)
  }

  const response = await fetchImpl(FIXED_SOC_TEMPLATE_URL)
  if (!response.ok) {
    throw new Error(`Unable to load SoC template data: ${templateId}`)
  }

  return normalizeSocTemplateDetail(await response.json(), 'Fixed JSON')
}

export async function loadSocTemplateCatalog(fetchImpl: FetchLike = fetch as FetchLike): Promise<SocTemplateSummary[]> {
  const detail = await loadSocTemplateDetail(FIXED_SOC_TEMPLATE_ID, fetchImpl)
  return [toSocTemplateSummary(detail)]
}
