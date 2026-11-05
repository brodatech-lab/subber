export type Word = { text: string; start: number; end: number }

export type Cue = {
  id: string
  start: number
  end: number
  text: string
  words: Word[]
  edited: boolean
}

export type VAlign = 'top' | 'middle' | 'bottom'
export type HAlign = 'left' | 'center' | 'right'
export type TextCase = 'none' | 'upper' | 'lower'
export type BgMode = 'wrap' | 'fill'
export type Animation = 'none' | 'growing'

export type SubtitleStyle = {
  font: string
  size: number
  bold: boolean
  italic: boolean
  underline: boolean
  textCase: TextCase
  align: HAlign
  vAlign: VAlign
  lineHeight: number
  color: string
  activeWordColor: string
  highlightActiveWord: boolean
  bg: { color: string; opacity: number; corners: number; padding: number; mode: BgMode }
  outline: { color: string; width: number }
  shadow: { color: string; distance: number }
  animation: Animation
  marginV: number
}

export type StylePreset = { id: string; name: string; style: SubtitleStyle }

export type SttEngineId = 'faster-whisper' | 'whisperx' | 'openai' | 'deepgram'

export type SttConfig = { engine: SttEngineId; model: string; language: string }

export type VideoInfo = { path: string; width: number; height: number; duration: number }
