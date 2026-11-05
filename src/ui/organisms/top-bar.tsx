import { useEffect, useRef, useState, type FC } from 'react'
import { ChevronDown, Download, FolderOpen, Sparkles } from 'lucide-react'
import { useProject } from '@/store/project'
import { burnIn, saveTextFile } from '@/lib/bridge'
import { toAss, toSrt, toVtt } from '@/lib/subtitle-formats'
import { Button } from '@/ui/atoms/button'

type TopBarProps = { onImport: () => void; onAutoSubtitle: () => void; onNotify: (message: string) => void }

const baseName = (path: string) => (path.split(/[\\/]/).pop() ?? 'napisy').replace(/\.[^.]+$/, '')

export const TopBar: FC<TopBarProps> = ({ onImport, onAutoSubtitle, onNotify }) => {
  const video = useProject((s) => s.video)
  const hasCues = useProject((s) => s.cues.length > 0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [exportPct, setExportPct] = useState<number | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const close = (e: MouseEvent) => !menuRef.current?.contains(e.target as Node) && setMenuOpen(false)
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [menuOpen])

  const exportText = async (kind: 'srt' | 'vtt' | 'ass') => {
    setMenuOpen(false)
    if (!video) return
    const { cues, style } = useProject.getState()
    const content =
      kind === 'srt' ? toSrt(cues, style.textCase) : kind === 'vtt' ? toVtt(cues, style.textCase) : toAss(cues, style, video)
    try {
      const path = await saveTextFile(`${baseName(video.path)}.${kind}`, kind, content)
      if (path) onNotify(`Zapisano ${kind.toUpperCase()}: ${path}`)
    } catch (e) {
      onNotify(`Nie udało się zapisać pliku: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const exportVideo = async () => {
    setMenuOpen(false)
    if (!video) return
    const { cues, style } = useProject.getState()
    try {
      setExportPct(0)
      const path = await burnIn(video, toAss(cues, style, video), (p) => setExportPct(p.percent))
      if (path) onNotify(`Wideo z napisami zapisane: ${path}`)
    } catch (e) {
      onNotify(e instanceof Error ? e.message : String(e))
    } finally {
      setExportPct(null)
    }
  }

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-surface px-3">
      <div className="flex items-center gap-2 pr-2">
        <div className="grid size-6 place-items-center rounded-[5px] bg-cue font-mono text-[11px] font-bold text-on-cue">S</div>
        <span className="text-sm font-semibold tracking-tight">Subber</span>
      </div>
      <span className="h-5 w-px bg-border" />
      <Button intent="ghost" size="sm" onClick={onImport}>
        <FolderOpen className="size-3.5" /> Otwórz wideo
      </Button>
      {video && (
        <span className="min-w-0 truncate font-mono text-[11px] text-faint" title={video.path}>
          {baseName(video.path)} · {video.width}×{video.height}
        </span>
      )}
      <div className="flex-1" />
      {exportPct !== null && (
        <div className="flex items-center gap-2 text-xs text-muted" aria-live="polite">
          Renderowanie
          <div className="h-1.5 w-32 overflow-hidden rounded-full bg-surface-raised">
            <div className="h-full bg-brand transition-[width]" style={{ width: `${exportPct}%` }} />
          </div>
          <span className="w-9 font-mono tabular-nums">{Math.round(exportPct)}%</span>
        </div>
      )}
      <Button intent={hasCues ? 'secondary' : 'primary'} onClick={onAutoSubtitle} disabled={!video}>
        <Sparkles className="size-3.5" /> Automatyczne napisy
      </Button>
      <div ref={menuRef} className="relative">
        <Button intent={hasCues ? 'primary' : 'secondary'} onClick={() => setMenuOpen((v) => !v)} disabled={!hasCues || exportPct !== null} aria-expanded={menuOpen}>
          <Download className="size-3.5" /> Eksport <ChevronDown className="size-3.5" />
        </Button>
        {menuOpen && (
          <div role="menu" className="absolute top-10 right-0 z-40 grid w-64 animate-enter gap-0.5 rounded-lg border border-border bg-surface-raised p-1 shadow-xl shadow-black/40">
            <MenuItem title="Wideo z napisami (MP4)" hint="Napisy wypalone w obrazie, ze stylem" onClick={exportVideo} />
            <span className="my-1 h-px bg-border" />
            <MenuItem title="SRT" hint="Uniwersalne napisy do odtwarzaczy i YouTube" onClick={() => exportText('srt')} />
            <MenuItem title="VTT" hint="Napisy dla stron WWW" onClick={() => exportText('vtt')} />
            <MenuItem title="ASS" hint="Napisy ze stylem i podświetlaniem słów" onClick={() => exportText('ass')} />
          </div>
        )}
      </div>
    </header>
  )
}

const MenuItem: FC<{ title: string; hint: string; onClick: () => void }> = ({ title, hint, onClick }) => (
  <button
    type="button"
    role="menuitem"
    onClick={onClick}
    className="grid gap-0.5 rounded-md px-3 py-2 text-left outline-none hover:bg-surface-hover focus-visible:bg-surface-hover"
  >
    <span className="text-[13px] font-medium">{title}</span>
    <span className="text-[11px] text-muted">{hint}</span>
  </button>
)
