import { memo, type CSSProperties, type FC } from 'react'
import type { Cue, SubtitleStyle } from '@/lib/types'

type SubtitleOverlayProps = {
  cue: Cue | undefined
  time: number
  style: SubtitleStyle
  /** displayed height / video height, so sizes in the style stay in video pixels like the ASS export */
  scale: number
}

const hexAlpha = (hex: string, opacity: number): string => {
  const a = Math.round(opacity * 255)
    .toString(16)
    .padStart(2, '0')
  return `${hex}${a}`
}

const caseOf = (text: string, mode: SubtitleStyle['textCase']) =>
  mode === 'upper' ? text.toUpperCase() : mode === 'lower' ? text.toLowerCase() : text

const textShadow = (style: SubtitleStyle, scale: number): string | undefined => {
  const parts: string[] = []
  const w = style.outline.width * scale
  if (w > 0) {
    for (let a = 0; a < 16; a++) {
      const r = (a / 16) * Math.PI * 2
      parts.push(`${(Math.cos(r) * w).toFixed(2)}px ${(Math.sin(r) * w).toFixed(2)}px 0 ${style.outline.color}`)
    }
  }
  const d = style.shadow.distance * scale
  if (d > 0) parts.push(`${d}px ${d}px ${d}px ${hexAlpha(style.shadow.color, 0.6)}`)
  return parts.length > 0 ? parts.join(',') : undefined
}

export const SubtitleOverlay: FC<SubtitleOverlayProps> = memo(({ cue, time, style, scale }) => {
  if (!cue) return null
  const fontSize = style.size * scale
  const pad = style.bg.padding * scale
  const hasBg = style.bg.opacity > 0
  const justify = style.align === 'left' ? 'flex-start' : style.align === 'right' ? 'flex-end' : 'center'
  const vertical: CSSProperties =
    style.vAlign === 'top'
      ? { top: style.marginV * scale }
      : style.vAlign === 'middle'
        ? { top: '50%', transform: 'translateY(-50%)' }
        : { bottom: style.marginV * scale }

  const textStyle: CSSProperties = {
    fontFamily: `'${style.font}', 'Montserrat', sans-serif`,
    fontSize,
    fontWeight: style.bold ? 800 : 500,
    fontStyle: style.italic ? 'italic' : 'normal',
    textDecoration: style.underline ? 'underline' : 'none',
    lineHeight: style.lineHeight,
    color: style.color,
    textShadow: textShadow(style, scale),
    textAlign: style.align,
    background: hasBg ? hexAlpha(style.bg.color, style.bg.opacity) : undefined,
    padding: hasBg ? `${pad * 0.4}px ${pad}px` : undefined,
    borderRadius: hasBg ? `${(style.bg.corners / 100) * fontSize}px` : undefined,
    boxDecorationBreak: 'clone',
    WebkitBoxDecorationBreak: 'clone',
    display: style.bg.mode === 'fill' ? 'block' : 'inline',
  }

  const words = cue.words.length > 0 ? cue.words : [{ text: cue.text, start: cue.start, end: cue.end }]
  const activeIndex = style.highlightActiveWord ? words.findIndex((w, i) => time >= w.start && time < (words[i + 1]?.start ?? cue.end)) : -1

  return (
    <div
      className="pointer-events-none absolute inset-x-0 flex px-[6%]"
      style={{ ...vertical, justifyContent: justify }}
    >
      <div
        key={cue.id}
        className={style.animation === 'growing' ? 'animate-grow' : undefined}
        style={{ maxWidth: '100%', textAlign: style.align }}
      >
        <span style={textStyle}>
          {words.map((w, i) => (
            <span key={i} style={i === activeIndex ? { color: style.activeWordColor } : undefined}>
              {caseOf(w.text, style.textCase)}
              {i < words.length - 1 ? ' ' : ''}
            </span>
          ))}
        </span>
      </div>
    </div>
  )
})
SubtitleOverlay.displayName = 'SubtitleOverlay'
