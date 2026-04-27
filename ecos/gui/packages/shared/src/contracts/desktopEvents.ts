export const desktopMenuEventIds = {
  newProject: 'new_project',
  openProject: 'open_project',
  save: 'save',
  saveAs: 'save_as',
  toggleSidebar: 'toggle_sidebar',
  toggleInspector: 'toggle_inspector',
  zoomIn: 'zoom_in',
  zoomOut: 'zoom_out',
  zoomReset: 'zoom_reset',
  documentation: 'documentation',
  releaseNotes: 'release_notes',
  reportIssue: 'report_issue',
} as const

export type DesktopMenuEventId =
  (typeof desktopMenuEventIds)[keyof typeof desktopMenuEventIds]

export type DesktopEventUnsubscribe = () => void
