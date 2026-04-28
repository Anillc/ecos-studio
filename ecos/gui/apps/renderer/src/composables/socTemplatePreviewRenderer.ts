import type { SocTemplateDetail, SocTemplateRect } from './socTemplateMapper'

export type SocPreviewRect = {
  coreId: number
  label: string
  leftPct: number
  topPct: number
  widthPct: number
  heightPct: number
  align: string
  orient: string
}

function toProjectedPercent(value: number, size: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(size) || size <= 0) {
    return 0
  }

  return (value / size) * 100
}

export function buildSocPreviewRects(template: SocTemplateDetail): SocPreviewRect[] {
  return template.cores.map(core => ({
    coreId: core.id,
    label: core.name.split('/').pop() ?? core.name,
    leftPct: toProjectedPercent(core.boundingBox.llx - template.coreArea.llx, template.coreArea.width),
    topPct: toProjectedPercent(template.coreArea.ury - core.boundingBox.ury, template.coreArea.height),
    widthPct: toProjectedPercent(core.boundingBox.width, template.coreArea.width),
    heightPct: toProjectedPercent(core.boundingBox.height, template.coreArea.height),
    align: core.align,
    orient: core.orient,
  }))
}

export function formatSocBoundingBox(box: SocTemplateRect): string {
  return `${box.llx}, ${box.lly}, ${box.urx}, ${box.ury}`
}
