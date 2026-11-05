import { useEffect, useRef, useState, type FC } from 'react'
import { Film } from 'lucide-react'
import { useProject } from '@/store/project'
import { registerVideo } from '@/lib/player'
import { SubtitleOverlay } from '@/ui/molecules/subtitle-overlay'
import { Button } from '@/ui/atoms/button'

type PreviewProps = { src: string | null; onImport: () => void }

const useActiveCue = () => {
  const cues = useProject((s) => s.cues)
  const time = useProject((s) => s.playhead)
  return { cue: cues.find((c) => time >= c.start && time < c.end), time }
}

export const Preview: FC<PreviewProps> = ({ src, onImport }) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const video = useProject((s) => s.video)
  const style = useProject((s) => s.style)
  const setPlayhead = useProject((s) => s.setPlayhead)
  const { cue, time } = useActiveCue()

  useEffect(() => {
    registerVideo(videoRef.current)
    return () => registerVideo(null)
  }, [src])

  // Playhead follows the video at display rate while playing.
  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    let raf = 0
    const tick = () => {
      setPlayhead(el.currentTime)
      raf = requestAnimationFrame(tick)
    }
    const start = () => (raf = requestAnimationFrame(tick))
    const stop = () => {
      cancelAnimationFrame(raf)
      setPlayhead(el.currentTime)
    }
    el.addEventListener('play', start)
    el.addEventListener('pause', stop)
    el.addEventListener('seeked', stop)
    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('play', start)
      el.removeEventListener('pause', stop)
      el.removeEventListener('seeked', stop)
    }
  }, [src, setPlayhead])

  useEffect(() => {
    const frame = frameRef.current
    if (!frame || !video) return
    const observer = new ResizeObserver(() => setScale(frame.clientHeight / video.height))
    observer.observe(frame)
    return () => observer.disconnect()
  }, [video])

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
    <div className="grid h-full min-h-0 place-items-center p-6">
      <div
        ref={frameRef}
        className="relative h-full max-h-full overflow-hidden rounded-md bg-black shadow-[0_0_0_1px_var(--color-border)]"
        style={{ aspectRatio: `${video.width} / ${video.height}` }}
      >
        <video ref={videoRef} src={src} className="size-full object-contain" preload="auto" />
        <SubtitleOverlay cue={cue} time={time} style={style} scale={scale} />
      </div>
    </div>
  )
}
