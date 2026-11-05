import type { StylePreset, SubtitleStyle } from './types'

export const DEFAULT_STYLE: SubtitleStyle = {
  font: 'Montserrat',
  size: 48,
  bold: true,
  italic: false,
  underline: false,
  textCase: 'none',
  align: 'center',
  vAlign: 'bottom',
  lineHeight: 1.2,
  color: '#FFFFFF',
  activeWordColor: '#1FE0D2',
  highlightActiveWord: true,
  bg: { color: '#000000', opacity: 0.8, corners: 15, padding: 10, mode: 'wrap' },
  outline: { color: '#000000', width: 0 },
  shadow: { color: '#000000', distance: 0 },
  animation: 'none',
  marginV: 220,
}

const preset = (id: string, name: string, patch: Partial<SubtitleStyle>): StylePreset => ({
  id,
  name,
  style: { ...DEFAULT_STYLE, ...patch },
})

export const BUILTIN_PRESETS: StylePreset[] = [
  preset('default', 'Default', {}),
  preset('popart', 'Pop Art', {
    color: '#F2F23A',
    activeWordColor: '#5BE05B',
    bg: { ...DEFAULT_STYLE.bg, opacity: 0 },
    outline: { color: '#000000', width: 4 },
    textCase: 'upper',
    animation: 'growing',
  }),
  preset('highlighter', 'Highlighter', {
    activeWordColor: '#FFE600',
    bg: { ...DEFAULT_STYLE.bg, opacity: 0 },
    outline: { color: '#000000', width: 3 },
    align: 'left',
  }),
  preset('poise', 'Poise', {
    italic: true,
    bold: false,
    highlightActiveWord: false,
    bg: { ...DEFAULT_STYLE.bg, opacity: 0 },
    outline: { color: '#000000', width: 2 },
  }),
  preset('editorial', 'Editorial', {
    font: 'Georgia',
    bold: false,
    italic: true,
    highlightActiveWord: false,
    bg: { ...DEFAULT_STYLE.bg, opacity: 0 },
    shadow: { color: '#000000', distance: 3 },
  }),
]
