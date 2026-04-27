import { getDesktopApi, hasDesktopApi } from '@/platform/desktop'

export async function setDesktopWindowTitle(title: string): Promise<void> {
  if (!hasDesktopApi()) {
    return
  }

  await getDesktopApi().window.setTitle(title)
}
