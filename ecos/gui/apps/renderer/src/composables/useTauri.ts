import { getDesktopApi, hasDesktopApi } from '@/platform/desktop'

const DESKTOP_RUNTIME_MESSAGE =
  'This feature is only available in the desktop app. Please run it with the ECOS desktop client.'

export function isDesktopRuntime(): boolean {
  return hasDesktopApi()
}

export function requireDesktopRuntime() {
  return getDesktopApi()
}

export function isTauri(): boolean {
  return isDesktopRuntime()
}

/**
 * useTauri composable
 * 提供桌面运行时相关的状态和守卫函数
 */
export function useTauri() {
  const isInTauri = isTauri()
  
  /**
   * 确保在桌面运行时中执行操作
   * 如果桥接层不可用，抛出错误或显示提示
   * 
   * @param showAlert 是否显示警告弹窗，默认为 true
   * @throws {Error} 如果不在桌面运行时且 showAlert 为 false
   */
  function ensureTauri(showAlert = true): void {
    if (!isInTauri) {
      const message = DESKTOP_RUNTIME_MESSAGE
      
      if (showAlert) {
        alert(message)
      } else {
        throw new Error(message)
      }
    }
  }
  
  return {
    /** 是否在 Tauri 环境中 */
    isInTauri,
    /** 确保在 Tauri 环境中执行 */
    ensureTauri,
    /** 检测函数（向后兼容） */
    isTauri,
    /** 获取桌面桥接层（向后兼容过渡期使用） */
    requireDesktopRuntime,
  }
}
