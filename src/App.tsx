import { useCallback, useEffect, useRef, useState, type FC } from 'react'
import { useProject } from '@/store/project'
import { isTauri, loadPeaks, pickVideo, readVideoInfo, videoSrc } from '@/lib/bridge'
import { seek, togglePlay } from '@/lib/player'
import { TopBar } from '@/ui/organisms/top-bar'
import { Preview } from '@/ui/organisms/preview'
import { SubtitleList } from '@/ui/organisms/subtitle-list'
import { StylePanel } from '@/ui/organisms/style-panel'
import { Timeline } from '@/ui/organisms/timeline'
import { AutoSubtitleDialog } from '@/ui/organisms/auto-subtitle-dialog'

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)

const useShortcuts = () => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return
      const s = useProject.getState()
      const mod = e.ctrlKey || e.metaKey
      if (e.code === 'Space') {
        e.preventDefault()
        togglePlay()
      } else if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) s.redo()
        else s.undo()
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        s.redo()
      } else if (e.key.toLowerCase() === 's' && !mod) {
        s.splitAt(s.playhead)
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && s.selectedId) {
        s.deleteCue(s.selectedId)
      } else if (e.key === 'ArrowLeft') {
        seek(s.playhead - (e.shiftKey ? 1 : 0.1))
      } else if (e.key === 'ArrowRight') {
        seek(s.playhead + (e.shiftKey ? 1 : 0.1))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

export const App: FC = () => {
  const [src, setSrc] = useState<string | null>(null)
  const [peaks, setPeaks] = useState<Float32Array | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  useShortcuts()

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(id)
  }, [toast])

  const load = useCallback(async (path: string, url: string, sizeBytes?: number) => {
    try {
      const info = await readVideoInfo(path, url)
      useProject.getState().setVideo(info)
      setSrc(url)
      setPeaks(null)
      setDialogOpen(true)
      loadPeaks(path, url, sizeBytes)
        .then(setPeaks)
        .catch(() => setToast('Nie udało się odczytać ścieżki audio do podglądu fali.'))
    } catch (e) {
      setToast(e instanceof Error ? e.message : String(e))
    }
  }, [])

  const importVideo = useCallback(async () => {
    if (!isTauri()) {
      fileInput.current?.click()
      return
    }
    const path = await pickVideo()
    if (path) await load(path, await videoSrc(path))
  }, [load])

  return (
    <div className="flex h-full flex-col">
      <TopBar onImport={importVideo} onAutoSubtitle={() => setDialogOpen(true)} onNotify={setToast} />
      <main className="grid min-h-0 flex-1 grid-cols-[22rem_1fr_19rem] border-b border-border">
        <aside className="min-h-0 border-r border-border">
          <SubtitleList />
        </aside>
        <section className="min-h-0 min-w-0 bg-canvas">
          <Preview src={src} onImport={importVideo} />
        </section>
        <aside className="min-h-0 border-l border-border">
          <StylePanel />
        </aside>
      </main>
      <div className="h-52 shrink-0">
        <Timeline peaks={peaks} />
      </div>

      <AutoSubtitleDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />

      {toast && (
        <div role="status" className="fixed bottom-56 left-1/2 z-50 max-w-lg -translate-x-1/2 animate-enter rounded-md border border-border bg-surface-raised px-4 py-2.5 text-xs shadow-xl shadow-black/40">
          {toast}
        </div>
      )}

      <input
        ref={fileInput}
        type="file"
        accept="video/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void load(file.name, URL.createObjectURL(file), file.size)
          e.target.value = ''
        }}
      />
    </div>
  )
}
