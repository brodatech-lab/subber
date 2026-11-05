import { memo, useCallback, useEffect, useMemo, useRef, useState, type FC, type PointerEvent as ReactPointerEvent } from 'react'
import { Pause, Play, Redo2, Scissors, Undo2, ZoomIn, ZoomOut } from 'lucide-react'
import { useProject } from '@/store/project'
import { seek, setRate, togglePlay } from '@/lib/player'
import { toDisplayTime } from '@/lib/time'
import { cn } from '@/lib/cn'
import type { Cue } from '@/lib/types'
import { Button } from '@/ui/atoms/button'

const RULER_H = 24
const TRACK_H = 34
const WAVE_H = 56
const HANDLE_W = 6
const MIN_PPS = 20
const MAX_PPS = 600
const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2]

type DragMode = 'move' | 'start' | 'end'

const tickStep = (pps: number): number => {
  const steps = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300]
  return steps.find((s) => s * pps >= 70) ?? 600
}

const rulerLabel = (t: number, step: number): string => {
  const m = Math.floor(t / 60)
  const s = t - m * 60
  const sec = step < 1 ? s.toFixed(1).replace(/\.0$/, '') : String(Math.round(s))
  return m > 0 ? `${m}:${sec.padStart(step < 1 ? 3 : 2, '0')}` : `:${sec}`
}

/* ------------------------------------------------------------------ */

const Transport: FC<{ pps: number; onZoom: (pps: number) => void }> = ({ pps, onZoom }) => {
  const [playing, setPlaying] = useState(false)
  const [rate, setRateState] = useState(1)
  const playhead = useProject((s) => s.playhead)
  const duration = useProject((s) => s.video?.duration ?? 0)
  const canUndo = useProject((s) => s.past.length > 0)
  const canRedo = useProject((s) => s.future.length > 0)
  const { undo, redo, splitAt } = useProject.getState()

  useEffect(() => {
    const el = document.querySelector('video')
    if (!el) return
    const on = () => setPlaying(true)
    const off = () => setPlaying(false)
    el.addEventListener('play', on)
    el.addEventListener('pause', off)
    return () => {
      el.removeEventListener('play', on)
      el.removeEventListener('pause', off)
    }
  }, [duration])

  const cycleRate = () => {
    const next = RATES[(RATES.indexOf(rate) + 1) % RATES.length] ?? 1
    setRateState(next)
    setRate(next)
  }

  return (
    <div className="flex h-11 items-center gap-1.5 border-b border-border px-3">
      <Button intent="primary" size="icon" className="w-12" onClick={togglePlay} aria-label={playing ? 'Pauza' : 'Odtwórz'}>
        {playing ? <Pause className="size-4" fill="currentColor" /> : <Play className="size-4" fill="currentColor" />}
      </Button>
      <Button size="sm" className="w-14 font-mono tabular-nums" onClick={cycleRate} title="Prędkość odtwarzania">
        {rate.toFixed(rate % 1 === 0 ? 1 : 2)}x
      </Button>
      <span className="mx-1 h-5 w-px bg-border" />
      <Button size="sm" onClick={() => splitAt(useProject.getState().playhead)} title="Podziel napis w miejscu głowicy (S)">
        <Scissors className="size-3.5" /> Podziel
      </Button>
      <Button size="sm" onClick={undo} disabled={!canUndo} title="Cofnij (Ctrl+Z)">
        <Undo2 className="size-3.5" /> Cofnij
      </Button>
      <Button size="sm" onClick={redo} disabled={!canRedo} title="Ponów (Ctrl+Y)">
        <Redo2 className="size-3.5" /> Ponów
      </Button>

      <div className="flex-1 text-center font-mono text-[13px] tabular-nums">
        <span className="font-medium text-foreground">{toDisplayTime(playhead)}</span>
        <span className="text-faint"> / {toDisplayTime(duration)}</span>
      </div>

      <div className="flex items-center gap-1">
        <Button intent="ghost" size="icon" aria-label="Oddal" onClick={() => onZoom(Math.max(MIN_PPS, pps / 1.4))}>
          <ZoomOut className="size-4" />
        </Button>
        <input
          type="range"
          aria-label="Powiększenie osi czasu"
          min={Math.log(MIN_PPS)}
          max={Math.log(MAX_PPS)}
          step={0.01}
          value={Math.log(pps)}
          onChange={(e) => onZoom(Math.exp(Number(e.target.value)))}
          className="w-28 accent-brand"
        />
        <Button intent="ghost" size="icon" aria-label="Przybliż" onClick={() => onZoom(Math.min(MAX_PPS, pps * 1.4))}>
          <ZoomIn className="size-4" />
        </Button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */

type BlockProps = {
  cue: Cue
  pps: number
  selected: boolean
  onPointerDown: (e: ReactPointerEvent, cue: Cue, mode: DragMode) => void
}

const CueBlock: FC<BlockProps> = memo(({ cue, pps, selected, onPointerDown }) => {
  const width = Math.max(4, (cue.end - cue.start) * pps)
  return (
    <div
      role="button"
      tabIndex={-1}
      aria-label={cue.text}
      onPointerDown={(e) => onPointerDown(e, cue, 'move')}
      className={cn(
        'group absolute top-1 flex cursor-grab items-center overflow-hidden rounded-[5px] border text-on-cue transition-[box-shadow,filter] active:cursor-grabbing',
        'bg-cue border-cue-edge hover:brightness-110',
        selected && 'shadow-[0_0_0_2px_var(--color-foreground)]',
      )}
      style={{ left: cue.start * pps, width, height: TRACK_H - 8 }}
    >
      <span
        onPointerDown={(e) => {
          e.stopPropagation()
          onPointerDown(e, cue, 'start')
        }}
        className="absolute inset-y-0 left-0 cursor-ew-resize bg-cue-edge/0 group-hover:bg-cue-edge"
        style={{ width: HANDLE_W }}
      />
      <span className="min-w-0 flex-1 truncate px-2.5 text-center text-xs font-semibold">{width > 26 ? cue.text : ''}</span>
      <span
        onPointerDown={(e) => {
          e.stopPropagation()
          onPointerDown(e, cue, 'end')
        }}
        className="absolute inset-y-0 right-0 cursor-ew-resize bg-cue-edge/0 group-hover:bg-cue-edge"
        style={{ width: HANDLE_W }}
      />
    </div>
  )
})
CueBlock.displayName = 'CueBlock'

/* ------------------------------------------------------------------ */

const Waveform: FC<{ peaks: Float32Array | null; pps: number; scrollLeft: number; viewWidth: number; duration: number }> = ({
  peaks,
  pps,
  scrollLeft,
  viewWidth,
  duration,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || viewWidth === 0) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = viewWidth * dpr
    canvas.height = WAVE_H * dpr
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, viewWidth, WAVE_H)
    if (!peaks || duration === 0) return
    const styles = getComputedStyle(document.documentElement)
    ctx.fillStyle = styles.getPropertyValue('--color-foreground').trim() || '#fff'
    const mid = WAVE_H - 4
    const perSecond = peaks.length / duration
    for (let x = 0; x < viewWidth; x++) {
      const t = (scrollLeft + x) / pps
      if (t > duration) break
      // A pixel can span several peaks when zoomed out; draw the loudest so short sounds don't vanish.
      const from = Math.floor(t * perSecond)
      const to = Math.max(from + 1, Math.floor(((scrollLeft + x + 1) / pps) * perSecond))
      let v = 0
      for (let i = from; i < to && i < peaks.length; i++) v = Math.max(v, peaks[i] ?? 0)
      const h = Math.max(1, v * (WAVE_H - 10))
      ctx.fillRect(x, mid - h, 1, h)
    }
  }, [peaks, pps, scrollLeft, viewWidth, duration])

  return <canvas ref={canvasRef} className="sticky left-0 block" style={{ width: viewWidth, height: WAVE_H }} />
}

/* ------------------------------------------------------------------ */

type TimelineProps = { peaks: Float32Array | null }

export const Timeline: FC<TimelineProps> = ({ peaks }) => {
  const [pps, setPps] = useState(160)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [viewWidth, setViewWidth] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const cues = useProject((s) => s.cues)
  const selectedId = useProject((s) => s.selectedId)
  const playhead = useProject((s) => s.playhead)
  const duration = useProject((s) => s.video?.duration ?? 0)
  const contentWidth = Math.max(viewWidth, duration * pps + 120)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const observer = new ResizeObserver(() => setViewWidth(el.clientWidth))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Keep the playhead in view during playback.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const x = playhead * pps
    if (x < el.scrollLeft || x > el.scrollLeft + el.clientWidth - 40) el.scrollLeft = Math.max(0, x - 80)
  }, [playhead, pps])

  const zoomAround = useCallback((next: number) => {
    const el = scrollRef.current
    const clamped = Math.min(MAX_PPS, Math.max(MIN_PPS, next))
    setPps((prev) => {
      if (el) {
        const anchor = useProject.getState().playhead
        const offset = anchor * prev - el.scrollLeft
        requestAnimationFrame(() => (el.scrollLeft = anchor * clamped - offset))
      }
      return clamped
    })
  }, [])

  const timeAt = (clientX: number): number => {
    const el = scrollRef.current
    if (!el) return 0
    const rect = el.getBoundingClientRect()
    return (clientX - rect.left + el.scrollLeft) / pps
  }

  const scrub = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    const target = e.currentTarget
    target.setPointerCapture(e.pointerId)
    seek(timeAt(e.clientX))
    useProject.getState().select(null)
    const move = (ev: PointerEvent) => seek(timeAt(ev.clientX))
    const up = () => {
      target.removeEventListener('pointermove', move)
      target.removeEventListener('pointerup', up)
    }
    target.addEventListener('pointermove', move)
    target.addEventListener('pointerup', up)
  }

  const startDrag = useCallback(
    (e: ReactPointerEvent, cue: Cue, mode: DragMode) => {
      if (e.button !== 0) return
      e.stopPropagation()
      const store = useProject.getState()
      store.select(cue.id)
      const originX = e.clientX
      const index = store.cues.findIndex((c) => c.id === cue.id)
      const prevEnd = store.cues[index - 1]?.end ?? 0
      const nextStart = store.cues[index + 1]?.start ?? (store.video?.duration ?? cue.end)
      let began = false

      const move = (ev: PointerEvent) => {
        const delta = (ev.clientX - originX) / pps
        if (!began) {
          if (Math.abs(ev.clientX - originX) < 3) return
          useProject.getState().beginDrag()
          began = true
        }
        const { updateCueTimes } = useProject.getState()
        if (mode === 'move') {
          const d = Math.min(Math.max(delta, prevEnd - cue.start), nextStart - cue.end)
          updateCueTimes(cue.id, cue.start + d, cue.end + d)
        } else if (mode === 'start') updateCueTimes(cue.id, cue.start + delta, cue.end)
        else updateCueTimes(cue.id, cue.start, cue.end + delta)
      }
      const up = () => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
        if (!began) seek(cue.start + 0.001)
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
    },
    [pps],
  )

  const ticks = useMemo(() => {
    const step = tickStep(pps)
    const from = Math.floor(scrollLeft / pps / step) * step
    const to = (scrollLeft + viewWidth) / pps
    const list: number[] = []
    for (let t = from; t <= to + step; t += step) list.push(Math.round(t * 1000) / 1000)
    return { list, step }
  }, [pps, scrollLeft, viewWidth])

  const visibleCues = useMemo(() => {
    const from = scrollLeft / pps - 1
    const to = (scrollLeft + viewWidth) / pps + 1
    return cues.filter((c) => c.end >= from && c.start <= to)
  }, [cues, pps, scrollLeft, viewWidth])

  return (
    <div className="flex h-full flex-col bg-surface">
      <Transport pps={pps} onZoom={zoomAround} />
      <div className="flex min-h-0 flex-1">
        <div className="flex w-9 shrink-0 flex-col border-r border-border text-[10px] text-faint">
          <div style={{ height: RULER_H }} />
          <div className="grid place-items-center font-mono" style={{ height: TRACK_H }} title="Napisy">
            CC
          </div>
          <div className="grid place-items-center font-mono" style={{ height: WAVE_H + 8 }} title="Audio">
            A1
          </div>
        </div>
        <div
          ref={scrollRef}
          onScroll={(e) => setScrollLeft(e.currentTarget.scrollLeft)}
          onWheel={(e) => {
            if (e.ctrlKey) {
              e.preventDefault()
              zoomAround(pps * (e.deltaY < 0 ? 1.15 : 1 / 1.15))
            }
          }}
          className="relative min-w-0 flex-1 overflow-x-auto overflow-y-hidden"
        >
          <div className="relative" style={{ width: contentWidth }}>
            <div
              onPointerDown={scrub}
              className="relative cursor-text border-b border-border font-mono text-[10px] text-muted"
              style={{ height: RULER_H }}
            >
              {ticks.list.map((t) => (
                <div key={t} className="absolute top-0 h-full border-l border-border-strong pl-1 pt-1" style={{ left: t * pps }}>
                  {rulerLabel(t, ticks.step)}
                </div>
              ))}
            </div>
            <div onPointerDown={scrub} className="relative border-b border-border" style={{ height: TRACK_H }}>
              {visibleCues.map((cue) => (
                <CueBlock key={cue.id} cue={cue} pps={pps} selected={cue.id === selectedId} onPointerDown={startDrag} />
              ))}
            </div>
            <div onPointerDown={scrub} className="relative py-1" style={{ height: WAVE_H + 8 }}>
              <div className="absolute inset-x-0 inset-y-1 rounded-sm border border-border-strong bg-wave" style={{ width: duration * pps }} />
              <div className="sticky left-0 w-0">
                <Waveform peaks={peaks} pps={pps} scrollLeft={scrollLeft} viewWidth={viewWidth} duration={duration} />
              </div>
            </div>
            <div className="pointer-events-none absolute inset-y-0 w-px bg-playhead" style={{ left: playhead * pps }}>
              <div className="absolute -top-px -left-[5px] h-3 w-[11px] rounded-b-[3px] bg-playhead" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
