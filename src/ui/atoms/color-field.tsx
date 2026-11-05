import type { FC } from 'react'

const QUICK = ['#000000', '#FFFFFF', '#FF6B63', '#FFC933', '#6BD65B', '#2F8CFF', '#B15CD9', '#1FE0D2']

type ColorFieldProps = { value: string; label: string; onChange: (hex: string) => void }

export const ColorField: FC<ColorFieldProps> = ({ value, label, onChange }) => (
  <div className="grid gap-2">
    <span className="text-xs text-muted">{label}</span>
    <div className="flex items-center gap-2">
      <label className="relative flex h-8 flex-1 cursor-pointer items-center gap-2 rounded-md bg-surface-raised px-2 hover:bg-surface-hover">
        <span className="size-4 rounded-sm border border-border-strong" style={{ background: value }} />
        <span className="font-mono text-xs uppercase tabular-nums">{value}</span>
        <input
          type="color"
          value={value}
          aria-label={label}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>
    </div>
    <div className="flex gap-1.5">
      {QUICK.map((hex) => (
        <button
          key={hex}
          type="button"
          aria-label={`${label} ${hex}`}
          onClick={() => onChange(hex)}
          style={{ background: hex }}
          className="size-5 rounded-sm border border-border-strong transition-transform outline-none hover:scale-110 focus-visible:ring-2 focus-visible:ring-brand active:scale-95"
        />
      ))}
    </div>
  </div>
)
