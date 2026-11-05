import { describe, expect, it } from 'vitest'
import { regroupWords, splitCue, cueFromWords } from './regroup'
import { toSrt, toVtt, toAss, assColor } from './subtitle-formats'
import { parseTime, toDisplayTime, toSrtTime } from './time'
import { DEFAULT_STYLE } from './default-style'

const words = 'Jeden panel zamiast 20 zakładek. Automatyzacje, serwery, strony SEO.'
  .split(' ')
  .map((text, i) => ({ text, start: i * 0.5, end: i * 0.5 + 0.45 }))

describe('time', () => {
  it('formats and parses', () => {
    expect(toSrtTime(4.261)).toBe('00:00:04,261')
    expect(toDisplayTime(4.261)).toBe('00:04.261')
    expect(parseTime('00:04.261')).toBeCloseTo(4.261)
    expect(parseTime('abc')).toBeNull()
  })
})

describe('regroup', () => {
  it('respects max chars', () => {
    const cues = regroupWords(words, 20)
    expect(cues.length).toBeGreaterThan(1)
    cues.forEach((c) => expect(c.text.length).toBeLessThanOrEqual(20))
    expect(cues.flatMap((c) => c.words)).toHaveLength(words.length)
  })
  it('never lets a cue cross a sentence end', () => {
    // Real faster-whisper timings from the test video around "w jednym miejscu. To jest DashX,".
    const real = [
      { text: 'w', start: 5.6, end: 5.64 },
      { text: 'jednym', start: 5.64, end: 5.86 },
      { text: 'miejscu.', start: 5.86, end: 6.26 },
      { text: 'To', start: 6.28, end: 6.64 },
      { text: 'jest', start: 6.64, end: 6.8 },
      { text: 'DashX,', start: 6.8, end: 7.16 },
    ]
    const cues = regroupWords(real, 14)
    expect(cues.map((c) => c.text)).toEqual(['w jednym', 'miejscu.', 'To jest DashX,'])
    expect(cues[2]?.start).toBe(6.28)
  })
  it('starts a new cue after a pause and bridges tiny gaps', () => {
    const cues = regroupWords(
      [
        { text: 'Tu', start: 0, end: 0.3 },
        { text: 'od', start: 0.32, end: 0.5 },
        { text: 'razu', start: 1.2, end: 1.5 },
      ],
      40,
    )
    expect(cues.map((c) => c.text)).toEqual(['Tu od', 'razu'])
    const bridged = regroupWords(
      [
        { text: 'Jeden.', start: 0, end: 0.5 },
        { text: 'Dwa.', start: 0.6, end: 1 },
      ],
      40,
    )
    expect(bridged[0]?.end).toBe(0.6)
  })
  it('splits a cue by word time', () => {
    const cue = cueFromWords(words.slice(0, 4))
    const result = splitCue(cue, 1.0)
    expect(result).not.toBeNull()
    expect(result?.[0].words).toHaveLength(2)
    expect(result?.[1].start).toBe(1.0)
  })
  it('rejects tiny splits', () => {
    expect(splitCue(cueFromWords(words.slice(0, 2)), 0.05)).toBeNull()
  })
})

describe('formats', () => {
  const cues = regroupWords(words, 25)
  it('srt', () => expect(toSrt(cues)).toContain('1\n00:00:00,000 --> '))
  it('vtt', () => expect(toVtt(cues).startsWith('WEBVTT')).toBe(true))
  it('ass color is BGR with alpha', () => {
    expect(assColor('#FF8800', 1)).toBe('&H000088FF')
    expect(assColor('#000000', 0.8)).toBe('&H33000000')
  })
  it('ass emits one event per word when highlighting', () => {
    const ass = toAss(cues, DEFAULT_STYLE, { width: 1080, height: 1920 })
    const events = ass.split('\n').filter((l) => l.startsWith('Dialogue'))
    expect(events).toHaveLength(words.length)
    expect(ass).toContain('PlayResY: 1920')
  })
})
