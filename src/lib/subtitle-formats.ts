import type { Cue, SubtitleStyle } from './types'
import { toAssTime, toSrtTime, toVttTime } from './time'

const applyCase = (text: string, mode: SubtitleStyle['textCase']): string =>
  mode === 'upper' ? text.toUpperCase() : mode === 'lower' ? text.toLowerCase() : text

export const toSrt = (cues: Cue[], textCase: SubtitleStyle['textCase'] = 'none'): string =>
  cues
    .map((cue, i) => `${i + 1}\n${toSrtTime(cue.start)} --> ${toSrtTime(cue.end)}\n${applyCase(cue.text, textCase)}\n`)
    .join('\n')

export const toVtt = (cues: Cue[], textCase: SubtitleStyle['textCase'] = 'none'): string =>
  `WEBVTT\n\n${cues
    .map((cue) => `${toVttTime(cue.start)} --> ${toVttTime(cue.end)}\n${applyCase(cue.text, textCase)}\n`)
    .join('\n')}`

/** `#RRGGBB` + opacity (0..1) → ASS `&HAABBGGRR`. */
export const assColor = (hex: string, opacity = 1): string => {
  const clean = hex.replace('#', '').padEnd(6, '0')
  const r = clean.slice(0, 2)
  const g = clean.slice(2, 4)
  const b = clean.slice(4, 6)
  const alpha = Math.round((1 - opacity) * 255)
    .toString(16)
    .padStart(2, '0')
  return `&H${alpha}${b}${g}${r}`.toUpperCase()
}

const assOverrideColor = (hex: string): string => assColor(hex).replace(/^&H00/, '&H') + '&'

const assAlignment = (style: SubtitleStyle): number => {
  const row = style.vAlign === 'bottom' ? 0 : style.vAlign === 'middle' ? 3 : 6
  const col = style.align === 'left' ? 1 : style.align === 'center' ? 2 : 3
  return row + col
}

const escapeAss = (text: string): string => text.replace(/[{}]/g, '').replace(/\r?\n/g, '\\N')

export type AssOptions = { width: number; height: number }

const ASS_BOLD_WEIGHT = 800

type StyleLine = {
  name: string
  primary: string
  outlineColour: string
  backColour: string
  borderStyle: 1 | 3
  outline: number
  shadow: number
}

const styleLine = (style: SubtitleStyle, line: StyleLine): string => {
  const flag = (on: boolean) => (on ? -1 : 0)
  return [
    `Style: ${line.name}`,
    style.font,
    style.size,
    line.primary,
    assColor(style.activeWordColor),
    line.outlineColour,
    line.backColour,
    // libass reads values other than 0/±1 as a font weight; 800 matches the preview's ExtraBold.
    style.bold ? ASS_BOLD_WEIGHT : 0,
    flag(style.italic),
    flag(style.underline),
    0,
    100,
    100,
    0,
    0,
    line.borderStyle,
    line.outline,
    line.shadow,
    assAlignment(style),
    40,
    40,
    style.marginV,
    1,
  ].join(',')
}

const hasBackground = (style: SubtitleStyle) => style.bg.opacity > 0

/**
 * Two styles. "Box" draws only the background: invisible text with an opaque box (BorderStyle 3).
 * "Text" draws the letters with outline and shadow, no box.
 * Keeping them apart matters: libass draws one box per color run, so a highlighted word split the line
 * into runs whose semi-transparent boxes overlapped into a dark vertical seam that moved with the word.
 */
const buildStyles = (style: SubtitleStyle): string[] => {
  const text = styleLine(style, {
    name: 'Text',
    primary: assColor(style.color),
    outlineColour: assColor(style.outline.color),
    backColour: assColor(style.shadow.color, style.shadow.distance > 0 ? 0.6 : 0),
    borderStyle: 1,
    outline: style.outline.width,
    shadow: style.shadow.distance,
  })
  if (!hasBackground(style)) return [text]
  const box = styleLine(style, {
    name: 'Box',
    primary: assColor(style.color, 0),
    outlineColour: assColor(style.bg.color, style.bg.opacity),
    backColour: assColor(style.bg.color, 0),
    borderStyle: 3,
    outline: style.bg.padding,
    shadow: 0,
  })
  return [box, text]
}

const growTag = '\\fscx85\\fscy85\\t(0,120,\\fscx100\\fscy100)'

const dialogue = (layer: number, start: number, end: number, styleName: string, text: string) =>
  `Dialogue: ${layer},${toAssTime(start)},${toAssTime(end)},${styleName},,0,0,0,,${text}`

const cueEvents = (cue: Cue, style: SubtitleStyle): string[] => {
  const grow = style.animation === 'growing' ? `{${growTag}}` : ''
  const plain = escapeAss(applyCase(cue.text, style.textCase))
  // One background per cue, drawn from the plain text so its size matches the letters on top.
  const box = hasBackground(style) ? [dialogue(0, cue.start, cue.end, 'Box', `${grow}${plain}`)] : []
  const words = cue.words
  if (!style.highlightActiveWord || words.length === 0) {
    return [...box, dialogue(1, cue.start, cue.end, 'Text', `${grow}${plain}`)]
  }
  const highlighted = words.map((word, index) => {
    const start = index === 0 ? cue.start : word.start
    const next = words[index + 1]
    const end = next ? next.start : cue.end
    const body = words
      .map((w, i) => {
        const text = escapeAss(applyCase(w.text, style.textCase))
        return i === index ? `{\\c${assOverrideColor(style.activeWordColor)}}${text}{\\c${assOverrideColor(style.color)}}` : text
      })
      .join(' ')
    return dialogue(1, start, end, 'Text', `${index === 0 ? grow : ''}${body}`)
  })
  return [...box, ...highlighted]
}

export const toAss = (cues: Cue[], style: SubtitleStyle, { width, height }: AssOptions): string =>
  [
    '[Script Info]',
    'ScriptType: v4.00+',
    `PlayResX: ${width}`,
    `PlayResY: ${height}`,
    'WrapStyle: 0',
    'ScaledBorderAndShadow: yes',
    '',
    '[V4+ Styles]',
    'Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding',
    ...buildStyles(style),
    '',
    '[Events]',
    'Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text',
    ...cues.flatMap((cue) => cueEvents(cue, style)),
    '',
  ].join('\n')
