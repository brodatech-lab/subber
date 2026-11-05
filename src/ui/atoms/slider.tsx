import type { FC } from 'react'

type SliderProps = {
  value: number
  min: number
  max: number
  step?: number
  label: string
  suffix?: string
  onChange: (value: number) => void
}

export const Slider: FC<SliderProps> = ({ value, min, max, step = 1, label, suffix = '', onChange }) => {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <label className="grid grid-cols-[4.5rem_1fr_3.25rem] items-center gap-3">
      <span className="text-xs text-muted">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ '--pct': `${pct}%` } as React.CSSProperties}
        className="h-4 w-full cursor-pointer appearance-none bg-transparent outline-none
          [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-full
          [&::-webkit-slider-runnable-track]:bg-[linear-gradient(to_right,var(--color-brand)_var(--pct),var(--color-border-strong)_var(--pct))]
          [&::-webkit-slider-thumb]:-mt-1 [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-foreground
          focus-visible:[&::-webkit-slider-thumb]:ring-2 focus-visible:[&::-webkit-slider-thumb]:ring-brand"
      />
      <span className="rounded-sm bg-surface-raised px-1.5 py-0.5 text-right font-mono text-xs tabular-nums">
        {value}
        {suffix}
      </span>
    </label>
  )
}
