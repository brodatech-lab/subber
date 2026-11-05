import type { Cue, Word } from './types'

export const MIN_CUE_SECONDS = 0.2

let counter = 0
export const newId = (): string => `c${Date.now().toString(36)}${(counter++).toString(36)}`

export const cueFromWords = (words: Word[]): Cue => {
  const first = words[0]
  const last = words[words.length - 1]
  if (!first || !last) throw new Error('cueFromWords: empty words')
  return {
    id: newId(),
    start: first.start,
    end: last.end,
    text: words.map((w) => w.text).join(' '),
    words,
    edited: false,
  }
}

const SENTENCE_END = /[.!?…]["»”)]*$/
const CLAUSE_END = /[,;:–—]["»”)]*$/
/** A silence this long between words means a new phrase starts. */
export const PAUSE_SECONDS = 0.35
/** Gaps shorter than this between cues are closed, so the text does not blink off mid-phrase. */
export const BRIDGE_SECONDS = 0.25

/** Extends each cue up to the next one when the gap between them is too short to read as a pause. */
const bridgeGaps = (cues: Cue[]): Cue[] =>
  cues.map((cue, i) => {
    const next = cues[i + 1]
    return next && next.start - cue.end > 0 && next.start - cue.end < BRIDGE_SECONDS ? { ...cue, end: next.start } : cue
  })

/**
 * Groups timed words into cues of at most `maxChars` characters.
 * A cue never crosses a sentence end or a pause in speech, otherwise its start would sit on the previous
 * sentence and the following text would trail behind the audio. Commas close a cue that is already half full.
 */
export const regroupWords = (words: Word[], maxChars: number): Cue[] => {
  const cues: Cue[] = []
  let bucket: Word[] = []
  let length = 0

  const flush = () => {
    if (bucket.length > 0) cues.push(cueFromWords(bucket))
    bucket = []
    length = 0
  }

  for (const word of words) {
    const previous = bucket[bucket.length - 1]
    const paused = previous !== undefined && word.start - previous.end >= PAUSE_SECONDS
    const overflows = bucket.length > 0 && length + 1 + word.text.length > maxChars
    if (paused || overflows) flush()

    length += word.text.length + (bucket.length > 0 ? 1 : 0)
    bucket.push(word)

    if (SENTENCE_END.test(word.text) || (CLAUSE_END.test(word.text) && length >= maxChars * 0.5)) flush()
  }
  flush()
  return bridgeGaps(cues)
}

/** Re-splits only cues the user has not edited by hand, keeping manual work intact. */
export const regroupPreservingEdits = (cues: Cue[], maxChars: number): Cue[] => {
  const result: Cue[] = []
  let run: Word[] = []
  const flushRun = () => {
    if (run.length > 0) result.push(...regroupWords(run, maxChars))
    run = []
  }
  for (const cue of cues) {
    if (cue.edited) {
      flushRun()
      result.push(cue)
    } else {
      run.push(...cue.words)
    }
  }
  flushRun()
  return result
}

/** Splits a cue at `time`, distributing words by their start time. Returns null if the split is not valid. */
export const splitCue = (cue: Cue, time: number): [Cue, Cue] | null => {
  if (time - cue.start < MIN_CUE_SECONDS || cue.end - time < MIN_CUE_SECONDS) return null
  let left = cue.words.filter((w) => w.start < time)
  let right = cue.words.filter((w) => w.start >= time)
  if (left.length === 0 || right.length === 0) {
    const tokens = cue.text.split(/\s+/).filter(Boolean)
    if (tokens.length < 2) return null
    const ratio = (time - cue.start) / (cue.end - cue.start)
    const cut = Math.min(tokens.length - 1, Math.max(1, Math.round(tokens.length * ratio)))
    left = []
    right = []
    tokens.forEach((text, index) => {
      const span = (cue.end - cue.start) / tokens.length
      const word = { text, start: cue.start + index * span, end: cue.start + (index + 1) * span }
      ;(index < cut ? left : right).push(word)
    })
  }
  const a: Cue = { ...cueFromWords(left), start: cue.start, end: time, edited: true }
  const b: Cue = { ...cueFromWords(right), start: time, end: cue.end, edited: true }
  return [a, b]
}

/** Rebuilds per-word timings after the text was edited by hand (even spread over the cue). */
export const wordsFromText = (text: string, start: number, end: number): Word[] => {
  const tokens = text.split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return []
  const span = (end - start) / tokens.length
  return tokens.map((t, i) => ({ text: t, start: start + i * span, end: start + (i + 1) * span }))
}
