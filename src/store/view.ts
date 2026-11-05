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
    const appWindow = getCurrentWindow()
    await appWindow.setFullscreen(on)
    // Switching to fullscreen can leave keyboard focus on the native window instead of the page,
    // and then Esc never reaches the app.
    await appWindow.setFocus()
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

/**
 * Keeps the preview in step with the window when fullscreen changes from outside the app
 * (for example the system leaves fullscreen). Returns a cleanup function.
 */
export const syncWithWindowFullscreen = (): (() => void) => {
  if (!isTauri()) return () => undefined
  let stop: (() => void) | undefined
  let cancelled = false
  void import('@tauri-apps/api/window').then(async ({ getCurrentWindow }) => {
    const appWindow = getCurrentWindow()
    const unlisten = await appWindow.onResized(async () => {
      const native = await appWindow.isFullscreen()
      if (!native && useView.getState().fullscreen) useView.setState({ fullscreen: false })
    })
    if (cancelled) unlisten()
    else stop = unlisten
  })
  return () => {
    cancelled = true
    stop?.()
  }
}
