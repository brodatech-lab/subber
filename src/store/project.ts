import { create } from 'zustand'
import type { Cue, StylePreset, SttConfig, SubtitleStyle, VideoInfo } from '@/lib/types'
import { DEFAULT_STYLE, BUILTIN_PRESETS } from '@/lib/default-style'
import { MIN_CUE_SECONDS, newId, regroupPreservingEdits, splitCue, wordsFromText } from '@/lib/regroup'

type Snapshot = { cues: Cue[]; style: SubtitleStyle }

type ProjectState = {
  video: VideoInfo | null
  cues: Cue[]
  style: SubtitleStyle
  presets: StylePreset[]
  stt: SttConfig
  maxChars: number
  selectedId: string | null
  playhead: number
  past: Snapshot[]
  future: Snapshot[]
}

type ProjectActions = {
  setVideo: (video: VideoInfo | null) => void
  setCues: (cues: Cue[]) => void
  setMaxChars: (value: number) => void
  setStt: (patch: Partial<SttConfig>) => void
  select: (id: string | null) => void
  setPlayhead: (time: number) => void
  updateCueText: (id: string, text: string) => void
  updateCueTimes: (id: string, start: number, end: number) => void
  addCueAt: (time: number) => void
  deleteCue: (id: string) => void
  splitAt: (time: number) => void
  setStyle: (patch: Partial<SubtitleStyle>) => void
  applyStyle: (style: SubtitleStyle) => void
  savePreset: (name: string) => void
  /** Pushes one history entry before a continuous edit (drag, time field) so it undoes in one step. */
  beginDrag: () => void
  undo: () => void
  redo: () => void
}

const HISTORY_LIMIT = 100

const snapshot = (s: ProjectState): Snapshot => ({ cues: s.cues, style: s.style })

const withHistory = (s: ProjectState, next: Partial<ProjectState>): Partial<ProjectState> => ({
  ...next,
  past: [...s.past, snapshot(s)].slice(-HISTORY_LIMIT),
  future: [],
})

/** Keeps a cue inside the gap between its neighbours; returns null when the gap is too small to hold a cue. */
const clampTimes = (cues: Cue[], id: string, start: number, end: number, duration: number) => {
  const index = cues.findIndex((c) => c.id === id)
  const prev = cues[index - 1]
  const next = cues[index + 1]
  const lo = prev ? prev.end : 0
  const hi = next ? next.start : duration
  if (hi - lo < MIN_CUE_SECONDS) return null
  const s = Math.min(Math.max(start, lo), hi - MIN_CUE_SECONDS)
  const e = Math.min(Math.max(end, s + MIN_CUE_SECONDS), hi)
  return { start: s, end: e }
}

export const useProject = create<ProjectState & ProjectActions>((set, get) => ({
  video: null,
  cues: [],
  style: DEFAULT_STYLE,
  presets: BUILTIN_PRESETS,
  stt: { engine: 'faster-whisper', model: 'large-v3', language: 'pl' },
  maxChars: 14,
  selectedId: null,
  playhead: 0,
  past: [],
  future: [],

  setVideo: (video) => set({ video, cues: [], past: [], future: [], selectedId: null, playhead: 0 }),
  setCues: (cues) => set((s) => withHistory(s, { cues })),
  setStt: (patch) => set((s) => ({ stt: { ...s.stt, ...patch } })),
  select: (id) => set({ selectedId: id }),
  setPlayhead: (playhead) => set({ playhead }),

  setMaxChars: (maxChars) =>
    set((s) => withHistory(s, { maxChars, cues: regroupPreservingEdits(s.cues, maxChars) })),

  updateCueText: (id, text) =>
    set((s) =>
      withHistory(s, {
        cues: s.cues.map((c) =>
          c.id === id ? { ...c, text, edited: true, words: wordsFromText(text, c.start, c.end) } : c,
        ),
      }),
    ),

  beginDrag: () => set((s) => withHistory(s, {})),

  updateCueTimes: (id, start, end) =>
    set((s) => {
      const duration = s.video?.duration ?? Number.POSITIVE_INFINITY
      const t = clampTimes(s.cues, id, start, end, duration)
      if (!t) return {}
      return {
        cues: s.cues.map((c) => {
          if (c.id !== id) return c
          const scale = (c.end - c.start) > 0 ? (t.end - t.start) / (c.end - c.start) : 1
          return {
            ...c,
            ...t,
            edited: true,
            words: c.words.map((w) => ({
              ...w,
              start: t.start + (w.start - c.start) * scale,
              end: t.start + (w.end - c.start) * scale,
            })),
          }
        }),
      }
    }),

  addCueAt: (time) =>
    set((s) => {
      const duration = s.video?.duration ?? time + 2
      const next = s.cues.find((c) => c.start >= time)
      const end = Math.min(time + 1.5, next ? next.start : duration)
      if (end - time < MIN_CUE_SECONDS) return {}
      const cue: Cue = { id: newId(), start: time, end, text: 'Nowy napis', words: [], edited: true }
      cue.words = wordsFromText(cue.text, cue.start, cue.end)
      const cues = [...s.cues, cue].sort((a, b) => a.start - b.start)
      return withHistory(s, { cues, selectedId: cue.id })
    }),

  deleteCue: (id) =>
    set((s) => withHistory(s, { cues: s.cues.filter((c) => c.id !== id), selectedId: null })),

  splitAt: (time) => {
    const s = get()
    const target = s.cues.find((c) => time > c.start && time < c.end)
    if (!target) return
    const parts = splitCue(target, time)
    if (!parts) return
    set(withHistory(s, { cues: s.cues.flatMap((c) => (c.id === target.id ? parts : [c])), selectedId: parts[0].id }))
  },

  setStyle: (patch) => set((s) => withHistory(s, { style: { ...s.style, ...patch } })),
  applyStyle: (style) => set((s) => withHistory(s, { style })),
  savePreset: (name) =>
    set((s) => ({ presets: [...s.presets, { id: newId(), name, style: s.style }] })),

  undo: () =>
    set((s) => {
      const prev = s.past[s.past.length - 1]
      if (!prev) return {}
      return { ...prev, past: s.past.slice(0, -1), future: [snapshot(s), ...s.future] }
    }),
  redo: () =>
    set((s) => {
      const next = s.future[0]
      if (!next) return {}
      return { ...next, past: [...s.past, snapshot(s)], future: s.future.slice(1) }
    }),
}))
