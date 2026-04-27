export {
  desktopApiEventChannels,
  desktopApiIpcChannels,
  ipcChannels,
  type DesktopApiEventChannel,
  type DesktopApiIpcChannel,
  type IpcChannel,
} from './constants/ipcChannels'
export type {
  DesktopApi,
  DesktopDirectoryDialogOptions,
  DesktopFileDialogFilter,
  DesktopFileDialogOptions,
  DesktopSettingsValue,
  PdkDetectedFiles,
  ScannedPdkDirectory,
} from './contracts/desktopApi'
export {
  appMenuActionIds,
  desktopMenuEventIds,
  type AppMenuAction,
  type DesktopEventUnsubscribe,
  type DesktopMenuEventId,
} from './contracts/desktopEvents'
export type { DesktopErrorCode, DesktopErrorShape } from './contracts/errors'
export type { DesktopFailure, DesktopResult, DesktopSuccess, VoidDesktopResult } from './types/desktop'
export type { WorkspaceConfig, WorkspaceParameters, WorkspaceStatus, WorkspaceSummary } from './types/workspace'
export type { TileGenerationRequest, TileGenerationResult } from './types/tile'
export {
  isAbsoluteLocalPath,
  isWindowsDrivePath,
  joinLocalPath,
  LocalPathOutsideRootError,
  normalizeLocalPath,
  resolveContainedLocalPath,
  resolveProjectFileAbsolutePath,
} from './utils/localPath'
