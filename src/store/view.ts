import { create } from 'zustand'
import { isTauri } from '@/lib/bridge'

type ViewState = {
  fullscreen: boolean
  setFullscreen: (on: boolean) => void
  toggleFullscreen: () => void
}

/**
 * The preview goes fullscreen as a fixed layer over the whole app, and the native window goes fullscreen
 * with it. WebView2 keeps the HTML Fullscreen API inside the window, so the window itself has to grow.
 */
const applyWindowFullscreen = async (on: boolean) => {
  if (isTauri()) {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    await getCurrentWindow().setFullscreen(on)
    return
  }
  if (on && !document.fullscreenElement) await document.documentElement.requestFullscreen().catch(() => undefined)
  if (!on && document.fullscreenElement) await document.exitFullscreen().catch(() => undefined)
}

export const useView = create<ViewState>((set, get) => ({
  fullscreen: false,
  setFullscreen: (on) => {
    if (get().fullscreen === on) return
    set({ fullscreen: on })
    void applyWindowFullscreen(on)
  },
  toggleFullscreen: () => get().setFullscreen(!get().fullscreen),
}))
