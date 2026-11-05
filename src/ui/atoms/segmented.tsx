import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

type Option<T extends string> = { value: T; label: ReactNode; title?: string }

type SegmentedProps<T extends string> = {
  value: T
  options: Option<T>[]
  onChange: (value: T) => void
  className?: string
}

export const Segmented = <T extends string>({ value, options, onChange, className }: SegmentedProps<T>) => (
  <div role="group" className={cn('inline-flex rounded-md bg-surface-raised p-0.5', className)}>
    {options.map((option) => (
      <button
        key={option.value}
        type="button"
        title={option.title}
        aria-pressed={option.value === value}
        onClick={() => onChange(option.value)}
        className={cn(
          'inline-flex h-7 min-w-8 items-center justify-center rounded-sm px-2 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand/70',
          option.value === value ? 'bg-brand text-on-brand' : 'text-muted hover:text-foreground',
        )}
      >
        {option.label}
      </button>
    ))}
  </div>
)
