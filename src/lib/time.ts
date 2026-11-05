const pad = (n: number, w = 2) => String(n).padStart(w, '0')

type Parts = { h: number; m: number; s: number; ms: number }

const split = (seconds: number): Parts => {
  const total = Math.max(0, Math.round(seconds * 1000))
  return {
    h: Math.floor(total / 3_600_000),
    m: Math.floor(total / 60_000) % 60,
    s: Math.floor(total / 1000) % 60,
    ms: total % 1000,
  }
}

export const toSrtTime = (seconds: number): string => {
  const { h, m, s, ms } = split(seconds)
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`
}

export const toVttTime = (seconds: number): string => toSrtTime(seconds).replace(',', '.')

export const toAssTime = (seconds: number): string => {
  const total = Math.max(0, Math.round(seconds * 100))
  const h = Math.floor(total / 360_000)
  const m = Math.floor(total / 6000) % 60
  const s = Math.floor(total / 100) % 60
  return `${h}:${pad(m)}:${pad(s)}.${pad(total % 100)}`
}

/** `00:04.261` style used in the subtitle list (minutes:seconds.millis, hours only when needed). */
export const toDisplayTime = (seconds: number): string => {
  const { h, m, s, ms } = split(seconds)
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms, 3)}` : `${pad(m)}:${pad(s)}.${pad(ms, 3)}`
}

/** Parses `mm:ss.mmm`, `hh:mm:ss.mmm`, `ss.mmm`; returns null when invalid. */
export const parseTime = (input: string): number | null => {
  const parts = input.trim().replace(',', '.').split(':')
  if (parts.length === 0 || parts.length > 3) return null
  const numbers = parts.map(Number)
  if (numbers.some((n) => Number.isNaN(n) || n < 0)) return null
  return numbers.reduce((acc, n) => acc * 60 + n, 0)
}
