import type {
  DesktopRuntimeAdapter,
  DesktopRuntimeEventListener,
} from './desktopRuntimeManager'
import { DesktopRuntimeManager } from './desktopRuntimeManager'

export type DesktopCliAdapter = DesktopRuntimeAdapter
export type DesktopCliEventListener = DesktopRuntimeEventListener

export interface DesktopCliBridgeServiceOptions {
  adapter: DesktopCliAdapter
}

export class DesktopCliBridgeService extends DesktopRuntimeManager {
  constructor(options: DesktopCliBridgeServiceOptions) {
    super(options)
  }
}
