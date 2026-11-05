import { useState, type FC, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'

type PanelSectionProps = { title: string; defaultOpen?: boolean; children: ReactNode }

export const PanelSection: FC<PanelSectionProps> = ({ title, defaultOpen = true, children }) => {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="border-b border-border">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-full items-center justify-between px-4 text-xs font-semibold tracking-wide text-foreground uppercase outline-none hover:bg-surface-raised focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/70"
      >
        {title}
        <ChevronDown className={cn('size-4 text-muted transition-transform', !open && '-rotate-90')} />
      </button>
      {open && <div className="grid gap-4 px-4 pt-1 pb-4">{children}</div>}
    </section>
  )
}
