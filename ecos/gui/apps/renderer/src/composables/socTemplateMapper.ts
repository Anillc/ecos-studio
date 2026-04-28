export type SocTemplateRect = {
  llx: number
  lly: number
  urx: number
  ury: number
  width: number
  height: number
  area?: number
}

export type SocTemplateCore = {
  id: number
  name: string
  info: string
  align: string
  orient: string
  boundingBox: SocTemplateRect
}

export type SocTemplateSummary = {
  id: string
  name: string
  info: string
  ioPinsCount: number
  coreCount: number
  sourceLabel: string
}

export type SocTemplateDetail = SocTemplateSummary & {
  die: SocTemplateRect
  coreArea: SocTemplateRect
  cores: SocTemplateCore[]
}

const FALLBACK_INFO = 'No info provided'

function normalizeInfo(value: unknown): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : FALLBACK_INFO
}

export function normalizeSocTemplateDetail(raw: any, sourceLabel: string): SocTemplateDetail {
  const cores = Array.isArray(raw?.cores?.list)
    ? raw.cores.list.map((core: any) => ({
        id: Number(core?.core_id ?? -1),
        name: String(core?.name ?? 'unknown-core'),
        info: normalizeInfo(core?.info),
        align: String(core?.io_align ?? 'unknown'),
        orient: String(core?.orient ?? 'unknown'),
        boundingBox: core?.bounding_box,
      }))
    : []

  return {
    id: String(raw?.design_name ?? 'unknown-template'),
    name: String(raw?.design_name ?? 'unknown-template'),
    info: normalizeInfo(raw?.info),
    ioPinsCount: Number(raw?.io_pins?.number ?? 0),
    coreCount: Number(raw?.cores?.number ?? cores.length),
    sourceLabel,
    die: raw?.die,
    coreArea: raw?.core,
    cores,
  }
}

export function toSocTemplateSummary(detail: SocTemplateDetail): SocTemplateSummary {
  return {
    id: detail.id,
    name: detail.name,
    info: detail.info,
    ioPinsCount: detail.ioPinsCount,
    coreCount: detail.coreCount,
    sourceLabel: detail.sourceLabel,
  }
}
