import { useEffect, useRef, useState, type FC } from 'react'
import { Film, Maximize, Minimize, Pause, Play } from 'lucide-react'
import { useProject } from '@/store/project'
import { useView } from '@/store/view'
import { registerVideo, togglePlay } from '@/lib/player'
import { toDisplayTime } from '@/lib/time'
import { cn } from '@/lib/cn'
import { SubtitleOverlay } from '@/ui/molecules/subtitle-overlay'
import { Button } from '@/ui/atoms/button'

type PreviewProps = { src: string | null; onImport: () => void }

type Size = { width: number; height: number }

const FRAME_GUTTER = 24
const CONTROLS_HIDE_MS = 2200

/** The subtitle layer follows the playhead every frame; keeping it apart stops the whole preview re-rendering. */
const LiveOverlay: FC<{ scale: number }> = ({ scale }) => {
  const cues = useProject((s) => s.cues)
  const time = useProject((s) => s.playhead)
  const style = useProject((s) => s.style)
  const cue = cues.find((c) => time >= c.start && time < c.end)
  return <SubtitleOverlay cue={cue} time={time} style={style} scale={scale} />
}

/** Largest frame with the video's aspect ratio that fits the stage, like object-fit: contain. */
const useContainedSize = (stage: HTMLElement | null, video: Size | null, gutter: number): Size | null => {
  const [size, setSize] = useState<Size | null>(null)
  useEffect(() => {
    if (!stage || !video) return
    const fit = () => {
      const width = Math.max(0, stage.clientWidth - gutter * 2)
      const height = Math.max(0, stage.clientHeight - gutter * 2)
      const scale = Math.min(width / video.width, height / video.height)
      setSize({ width: Math.floor(video.width * scale), height: Math.floor(video.height * scale) })
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [stage, video, gutter])
  return size
}

/** Publishes the element's play state to the view store, which the transport bars read. */
const useSyncPlaying = (video: HTMLVideoElement | null) => {
  useEffect(() => {
    if (!video) return
    const sync = () => useView.setState({ playing: !video.paused })
    sync()
    video.addEventListener('play', sync)
    video.addEventListener('pause', sync)
    return () => {
      video.removeEventListener('play', sync)
      video.removeEventListener('pause', sync)
      useView.setState({ playing: false })
    }
  }, [video])
}

/** Controls fade out after the mouse rests, and come back on any movement. */
const useIdle = (active: boolean) => {
  const [idle, setIdle] = useState(false)
  const timer = useRef<number>(0)
  const wake = () => {
    setIdle(false)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setIdle(true), CONTROLS_HIDE_MS)
  }
  useEffect(() => {
    if (!active) setIdle(false)
    return () => window.clearTimeout(timer.current)
  }, [active])
  return { idle: active && idle, wake }
}

const FullscreenBar: FC<{ hidden: boolean }> = ({ hidden }) => {
  const playing = useView((s) => s.playing)
  const time = useProject((s) => s.playhead)
  const duration = useProject((s) => s.video?.duration ?? 0)
  const exit = useView((s) => s.setFullscreen)
  return (
    <div
      className={cn(
        'absolute inset-x-0 bottom-0 flex items-center gap-3 bg-gradient-to-t from-black/80 to-transparent px-6 pt-10 pb-5 transition-opacity duration-300',
        hidden && 'pointer-events-none opacity-0',
      )}
    >
      <Button intent="primary" size="icon" className="w-12" onClick={togglePlay} aria-label={playing ? 'Pauza' : 'Odtwórz'}>
        {playing ? <Pause className="size-4" fill="currentColor" /> : <Play className="size-4" fill="currentColor" />}
      </Button>
      <span className="font-mono text-[13px] text-white tabular-nums">
        {toDisplayTime(time)} <span className="text-white/50">/ {toDisplayTime(duration)}</span>
      </span>
      <div className="flex-1" />
      <Button intent="ghost" size="sm" className="text-white hover:bg-white/10 hover:text-white" onClick={() => exit(false)}>
        <Minimize className="size-4" /> Zamknij pełny ekran
        <kbd className="ml-1 rounded-sm bg-white/15 px-1 font-mono text-[10px]">Esc</kbd>
      </Button>
    </div>
  )
}

export const Preview: FC<PreviewProps> = ({ src, onImport }) => {
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null)
  const [stage, setStage] = useState<HTMLDivElement | null>(null)
  const video = useProject((s) => s.video)
  const setPlayhead = useProject((s) => s.setPlayhead)
  const fullscreen = useView((s) => s.fullscreen)
  const toggleFullscreen = useView((s) => s.toggleFullscreen)
  const frame = useContainedSize(stage, video, fullscreen ? 0 : FRAME_GUTTER)
  useSyncPlaying(videoEl)
  const { idle, wake } = useIdle(fullscreen)

  useEffect(() => {
    registerVideo(videoEl)
    return () => registerVideo(null)
  }, [videoEl])

  // Playhead follows the video at display rate while playing.
  useEffect(() => {
    if (!videoEl) return
    let raf = 0
    const tick = () => {
      setPlayhead(videoEl.currentTime)
      raf = requestAnimationFrame(tick)
    }
    const start = () => (raf = requestAnimationFrame(tick))
    const stop = () => {
      cancelAnimationFrame(raf)
      setPlayhead(videoEl.currentTime)
    }
    videoEl.addEventListener('play', start)
    videoEl.addEventListener('pause', stop)
    videoEl.addEventListener('seeked', stop)
    return () => {
      cancelAnimationFrame(raf)
      videoEl.removeEventListener('play', start)
      videoEl.removeEventListener('pause', stop)
      videoEl.removeEventListener('seeked', stop)
    }
  }, [videoEl, setPlayhead])

  if (!src || !video) {
    return (
      <div className="grid h-full place-items-center">
        <div className="grid max-w-xs justify-items-center gap-4 text-center">
          <div className="grid size-14 place-items-center rounded-lg border border-border bg-surface">
            <Film className="size-6 text-muted" strokeWidth={1.5} />
          </div>
          <div className="grid gap-1">
            <p className="text-sm font-medium text-balance">Wczytaj film, żeby wygenerować napisy</p>
            <p className="text-xs text-muted text-pretty">MP4, MOV, MKV lub WebM. Plik zostaje na Twoim dysku.</p>
          </div>
          <Button intent="primary" onClick={onImport}>
            Wybierz plik wideo
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={setStage}
      onMouseMove={wake}
      className={cn(
        'group/stage grid min-h-0 place-items-center overflow-hidden',
        fullscreen ? 'fixed inset-0 z-[60] bg-black' : 'relative h-full',
        idle && 'cursor-none',
      )}
    >
      <div
        className={cn('relative overflow-hidden bg-black', !fullscreen && 'rounded-md shadow-[0_0_0_1px_var(--color-border)]')}
        style={frame ? { width: frame.width, height: frame.height } : { visibility: 'hidden' }}
      >
        <video
          ref={setVideoEl}
          src={src}
          preload="auto"
          onClick={togglePlay}
          onDoubleClick={toggleFullscreen}
          className="size-full cursor-pointer object-contain"
        />
        <LiveOverlay scale={frame ? frame.height / video.height : 1} />
      </div>

      {fullscreen ? (
        <FullscreenBar hidden={idle} />
      ) : (
        <Button
          intent="secondary"
          size="icon"
          aria-label="Pełny ekran (F)"
          title="Pełny ekran (F)"
          onClick={toggleFullscreen}
          className="absolute right-3 bottom-3 opacity-0 transition-opacity group-hover/stage:opacity-100 focus-visible:opacity-100"
        >
          <Maximize className="size-4" />
        </Button>
      )}
    </div>
  )
}
