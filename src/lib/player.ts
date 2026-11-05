import { useProject } from '@/store/project'

/** Single shared <video> element; the Preview organism registers it, everything else drives it from here. */
let element: HTMLVideoElement | null = null

export const registerVideo = (el: HTMLVideoElement | null): void => {
  element = el
}

export const seek = (time: number): void => {
  const duration = useProject.getState().video?.duration ?? 0
  const clamped = Math.min(Math.max(time, 0), duration)
  if (element) element.currentTime = clamped
  useProject.getState().setPlayhead(clamped)
}

export const togglePlay = (): void => {
  if (!element) return
  if (element.paused) void element.play()
  else element.pause()
}

export const setRate = (rate: number): void => {
  if (element) element.playbackRate = rate
}
