import type { SttConfig, VideoInfo, Word } from './types'

export const isTauri = (): boolean => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

export type TranscribeProgress = { stage: string; percent: number }
export type ExportProgress = { percent: number }

export const pickVideo = async (): Promise<string | null> => {
  if (!isTauri()) return null
  const { open } = await import('@tauri-apps/plugin-dialog')
  const result = await open({
    multiple: false,
    filters: [{ name: 'Wideo', extensions: ['mp4', 'mov', 'mkv', 'webm', 'avi', 'm4v'] }],
  })
  return typeof result === 'string' ? result : null
}

export const videoSrc = async (path: string): Promise<string> => {
  if (!isTauri()) return path
  const { convertFileSrc, invoke } = await import('@tauri-apps/api/core')
  // The asset protocol starts with an empty scope; only files the user opened become readable.
  await invoke('allow_video', { path })
  return convertFileSrc(path)
}

const VIDEO_INFO_TIMEOUT_MS = 20_000

export const readVideoInfo = (path: string, src: string): Promise<VideoInfo> =>
  new Promise((resolve, reject) => {
    const probe = document.createElement('video')
    probe.preload = 'metadata'
    const timer = window.setTimeout(() => {
      probe.removeAttribute('src')
      reject(new Error('Nie udało się odczytać długości filmu. Plik może być uszkodzony albo niepełny.'))
    }, VIDEO_INFO_TIMEOUT_MS)
    const done = () => {
      window.clearTimeout(timer)
      resolve({ path, width: probe.videoWidth, height: probe.videoHeight, duration: probe.duration })
    }
    probe.onloadedmetadata = () => {
      if (Number.isFinite(probe.duration)) return done()
      // Some WebM files (e.g. browser recordings) have no duration in the header; seeking far forces the browser to find it.
      probe.ondurationchange = () => {
        if (!Number.isFinite(probe.duration)) return
        probe.ondurationchange = null
        done()
      }
      probe.currentTime = Number.MAX_SAFE_INTEGER
    }
    probe.onerror = () => {
      window.clearTimeout(timer)
      reject(new Error('Nie można odczytać pliku wideo. Sprawdź, czy format jest obsługiwany.'))
    }
    probe.src = src
  })

/** Runs speech-to-text through the Rust backend; in a plain browser returns demo data so the UI is testable. */
export const transcribe = async (
  video: VideoInfo,
  config: SttConfig,
  onProgress: (p: TranscribeProgress) => void,
): Promise<Word[]> => {
  if (!isTauri()) return demoTranscribe(video, onProgress)
  const { invoke, Channel } = await import('@tauri-apps/api/core')
  const channel = new Channel<TranscribeProgress>()
  channel.onmessage = onProgress
  return invoke<Word[]>('transcribe', { path: video.path, config, onProgress: channel })
}

const DEMO_TEXT =
  'Jeden panel zamiast 20 zakładek. Automatyzacje, serwery, strony SEO, Facebook, płatności i dokumenty w jednym miejscu. To jest Dash X, mój własny panel. Pokażę Ci go od środka. Zaczynamy od pulpitu.'

const demoTranscribe = async (video: VideoInfo, onProgress: (p: TranscribeProgress) => void): Promise<Word[]> => {
  const stages = [
    ['Wyciąganie audio', 20],
    ['Transkrypcja', 70],
    ['Wyrównanie słów', 95],
  ] as const
  for (const [stage, percent] of stages) {
    onProgress({ stage, percent })
    await new Promise((r) => setTimeout(r, 350))
  }
  const tokens = DEMO_TEXT.split(' ')
  const span = Math.min(video.duration || 12, 14) / tokens.length
  return tokens.map((text, i) => ({ text, start: i * span, end: (i + 1) * span - 0.04 }))
}

export const saveTextFile = async (defaultName: string, extension: string, content: string): Promise<string | null> => {
  if (isTauri()) {
    const { save } = await import('@tauri-apps/plugin-dialog')
    const { invoke } = await import('@tauri-apps/api/core')
    const path = await save({ defaultPath: defaultName, filters: [{ name: extension.toUpperCase(), extensions: [extension] }] })
    if (!path) return null
    await invoke('write_text_file', { path, content })
    return path
  }
  const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = defaultName
  a.click()
  URL.revokeObjectURL(url)
  return defaultName
}

export type EngineLocation = { path: string; freeBytes: number | null; requiredBytes: number; installed: boolean }

export const getEngineLocation = async (engine: string): Promise<EngineLocation | null> => {
  if (!isTauri()) return null
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<EngineLocation>('engine_location', { engine })
}

/** Lets the user pick the engine folder; returns false when the picker was cancelled. */
export const chooseEngineFolder = async (current: string): Promise<boolean> => {
  const { open } = await import('@tauri-apps/plugin-dialog')
  const { invoke } = await import('@tauri-apps/api/core')
  const picked = await open({ directory: true, defaultPath: current, title: 'Folder silnika i modeli' })
  if (typeof picked !== 'string') return false
  await invoke('set_engine_location', { path: picked })
  return true
}

export type CloudProvider = 'openai' | 'deepgram'

export const hasApiKey = async (provider: CloudProvider): Promise<boolean> => {
  if (!isTauri()) return false
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<boolean>('has_api_key', { provider })
}

/** Stores the key in the Windows Credential Manager; an empty key removes it. */
export const setApiKey = async (provider: CloudProvider, key: string): Promise<void> => {
  if (!isTauri()) throw new Error('Klucze API zapisuje tylko aplikacja desktopowa.')
  const { invoke } = await import('@tauri-apps/api/core')
  await invoke('set_api_key', { provider, key })
}

/** Burns the ASS subtitles into a new MP4 via ffmpeg (Tauri only). */
export const burnIn = async (
  video: VideoInfo,
  ass: string,
  onProgress: (p: ExportProgress) => void,
): Promise<string | null> => {
  if (!isTauri()) throw new Error('Eksport wideo działa tylko w aplikacji desktopowej.')
  const { save } = await import('@tauri-apps/plugin-dialog')
  const { invoke, Channel } = await import('@tauri-apps/api/core')
  const output = await save({
    defaultPath: video.path.replace(/\.[^.\\/]+$/, '') + '_napisy.mp4',
    filters: [{ name: 'MP4', extensions: ['mp4'] }],
  })
  if (!output) return null
  const channel = new Channel<ExportProgress>()
  channel.onmessage = onProgress
  await invoke('burn_subtitles', { input: video.path, output, ass, duration: video.duration, onProgress: channel })
  return output
}

/** Above this size the browser-only fallback skips the waveform; decoding would load the whole file into memory. */
const BROWSER_WAVEFORM_LIMIT_BYTES = 300 * 1024 * 1024
const BROWSER_PEAK_BUCKETS = 8000

/**
 * Normalized waveform peaks for the timeline, or null when they cannot be computed cheaply.
 * The desktop app streams the audio through ffmpeg in Rust, so file size does not matter there.
 */
export const loadPeaks = async (path: string, src: string, sizeBytes?: number): Promise<Float32Array | null> => {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core')
    return Float32Array.from(await invoke<number[]>('waveform_peaks', { path }))
  }
  if (sizeBytes !== undefined && sizeBytes > BROWSER_WAVEFORM_LIMIT_BYTES) return null
  return decodePeaksInBrowser(src, BROWSER_PEAK_BUCKETS)
}

const decodePeaksInBrowser = async (src: string, buckets: number): Promise<Float32Array> => {
  const buffer = await fetch(src).then((r) => r.arrayBuffer())
  const ctx = new OfflineAudioContext(1, 1, 8000)
  const audio = await ctx.decodeAudioData(buffer)
  const data = audio.getChannelData(0)
  const size = Math.max(1, Math.floor(data.length / buckets))
  const peaks = new Float32Array(buckets)
  let max = 0
  for (let b = 0; b < buckets; b++) {
    let peak = 0
    for (let i = b * size; i < (b + 1) * size && i < data.length; i++) {
      const v = Math.abs(data[i] ?? 0)
      if (v > peak) peak = v
    }
    peaks[b] = peak
    if (peak > max) max = peak
  }
  return max > 0 ? peaks.map((p) => p / max) : peaks
}
