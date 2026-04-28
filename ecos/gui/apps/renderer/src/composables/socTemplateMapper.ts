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
const FALLBACK_TEMPLATE_ID = 'unknown-template'
const FALLBACK_CORE_NAME = 'unknown-core'
const FALLBACK_TEXT = 'unknown'

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null
}

function toRecord(value: unknown): UnknownRecord {
  return isRecord(value) ? value : {}
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }

  return fallback
}

function toText(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback
}

function normalizeInfo(value: unknown): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : FALLBACK_INFO
}

function normalizeRect(value: unknown): SocTemplateRect {
  const rect = toRecord(value)

  return {
    llx: toNumber(rect.llx),
    lly: toNumber(rect.lly),
    urx: toNumber(rect.urx),
    ury: toNumber(rect.ury),
    width: toNumber(rect.width),
    height: toNumber(rect.height),
    area: toNumber(rect.area),
  }
}

export function normalizeSocTemplateDetail(raw: any, sourceLabel: string): SocTemplateDetail {
  const rawRecord = toRecord(raw)
  const rawCores = toRecord(rawRecord.cores)
  const coreList = Array.isArray(rawCores.list) ? rawCores.list : []

  const cores = coreList.map((core): SocTemplateCore => {
    const coreRecord = toRecord(core)

    return {
      id: toNumber(coreRecord.core_id, -1),
      name: toText(coreRecord.name, FALLBACK_CORE_NAME),
      info: normalizeInfo(coreRecord.info),
      align: toText(coreRecord.io_align, FALLBACK_TEXT),
      orient: toText(coreRecord.orient, FALLBACK_TEXT),
      boundingBox: normalizeRect(coreRecord.bounding_box),
    }
  })

  const designName = toText(rawRecord.design_name, FALLBACK_TEMPLATE_ID)

  return {
    id: designName,
    name: designName,
    info: normalizeInfo(rawRecord.info),
    ioPinsCount: toNumber(toRecord(rawRecord.io_pins).number),
    coreCount: toNumber(rawCores.number, cores.length),
    sourceLabel,
    die: normalizeRect(rawRecord.die),
    coreArea: normalizeRect(rawRecord.core),
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
