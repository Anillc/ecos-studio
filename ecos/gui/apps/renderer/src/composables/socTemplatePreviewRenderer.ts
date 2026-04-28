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

export function buildSocPreviewRects(template: SocTemplateDetail): SocPreviewRect[] {
  return template.cores.map(core => ({
    coreId: core.id,
    label: core.name.split('/').pop() ?? core.name,
    leftPct: ((core.boundingBox.llx - template.coreArea.llx) / template.coreArea.width) * 100,
    topPct: ((template.coreArea.ury - core.boundingBox.ury) / template.coreArea.height) * 100,
    widthPct: (core.boundingBox.width / template.coreArea.width) * 100,
    heightPct: (core.boundingBox.height / template.coreArea.height) * 100,
    align: core.align,
    orient: core.orient,
  }))
}

export function formatSocBoundingBox(box: SocTemplateRect): string {
  return `${box.llx}, ${box.lly}, ${box.urx}, ${box.ury}`
}
