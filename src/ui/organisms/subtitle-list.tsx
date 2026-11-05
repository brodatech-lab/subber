import { memo, useEffect, useMemo, useRef, useState, type FC } from 'react'
import { Plus, Search, Trash2, X } from 'lucide-react'
import { useProject } from '@/store/project'
import { seek } from '@/lib/player'
import { parseTime, toDisplayTime } from '@/lib/time'
import { cn } from '@/lib/cn'
import type { Cue } from '@/lib/types'
import { Button } from '@/ui/atoms/button'

const TimeInput: FC<{ value: number; label: string; onCommit: (t: number) => void }> = ({ value, label, onCommit }) => {
  const [draft, setDraft] = useState<string | null>(null)
  const commit = () => {
    if (draft === null) return
    const t = parseTime(draft)
    if (t !== null) onCommit(t)
    setDraft(null)
  }
  return (
    <input
      type="text"
      aria-label={label}
      value={draft ?? toDisplayTime(value)}
      onFocus={(e) => {
        setDraft(toDisplayTime(value))
        e.currentTarget.select()
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') {
          setDraft(null)
          e.currentTarget.blur()
        }
      }}
      className="w-[4.75rem] rounded-sm bg-transparent px-1 py-0.5 font-mono text-[11px] text-faint tabular-nums outline-none hover:bg-surface-hover focus:bg-surface-hover focus:text-foreground"
    />
  )
}

type RowProps = { cue: Cue; active: boolean; selected: boolean }

const CueRow: FC<RowProps> = memo(({ cue, active, selected }) => {
  const ref = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const [text, setText] = useState(cue.text)
  useEffect(() => setText(cue.text), [cue.text])

  useEffect(() => {
    if (active || selected) ref.current?.scrollIntoView({ block: 'nearest' })
  }, [active, selected])

  useEffect(() => {
    const el = textRef.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = `${el.scrollHeight}px`
  }, [text])

  const { updateCueText, updateCueTimes, deleteCue, select, beginDrag } = useProject.getState()

  return (
    <div
      ref={ref}
      onClick={() => {
        select(cue.id)
        seek(cue.start + 0.001)
      }}
      className={cn(
        'group grid grid-cols-[auto_1fr_auto] items-start gap-2 border-b border-border/60 px-2 py-2 transition-colors',
        active ? 'bg-brand/8' : 'hover:bg-surface-raised',
        selected && 'shadow-[inset_2px_0_0_var(--color-brand)]',
      )}
    >
      <TimeInput
        value={cue.start}
        label="Początek napisu"
        onCommit={(t) => {
          beginDrag()
          updateCueTimes(cue.id, t, cue.end)
        }}
      />
      <textarea
        ref={textRef}
        rows={1}
        value={text}
        aria-label="Tekst napisu"
        onChange={(e) => setText(e.target.value)}
        onBlur={() => text !== cue.text && updateCueText(cue.id, text.trim() || cue.text)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            e.currentTarget.blur()
          }
          e.stopPropagation()
        }}
        className={cn(
          'w-full resize-none overflow-hidden rounded-sm bg-transparent px-1.5 py-0.5 text-[13px] leading-5 outline-none focus:bg-canvas focus:ring-1 focus:ring-border-strong',
          active && 'text-foreground',
        )}
      />
      <div className="flex items-center">
        <TimeInput
          value={cue.end}
          label="Koniec napisu"
          onCommit={(t) => {
            beginDrag()
            updateCueTimes(cue.id, cue.start, t)
          }}
        />
        <button
          type="button"
          aria-label="Usuń napis"
          onClick={(e) => {
            e.stopPropagation()
            deleteCue(cue.id)
          }}
          className="grid size-6 place-items-center rounded-sm text-faint opacity-0 transition-opacity outline-none group-hover:opacity-100 hover:text-danger focus-visible:opacity-100"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </div>
  )
})
CueRow.displayName = 'CueRow'

export const SubtitleList: FC = () => {
  const cues = useProject((s) => s.cues)
  const selectedId = useProject((s) => s.selectedId)
  const maxChars = useProject((s) => s.maxChars)
  const activeId = useProject((s) => s.cues.find((c) => s.playhead >= c.start && s.playhead < c.end)?.id)
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? cues.filter((c) => c.text.toLowerCase().includes(q)) : cues
  }, [cues, query])

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <div className="flex h-11 shrink-0 items-center gap-3 border-b border-border px-3">
        {searching ? (
          <div className="flex flex-1 items-center gap-2">
            <Search className="size-4 text-muted" />
            <input
              autoFocus
              type="text"
              value={query}
              placeholder="Szukaj w napisach"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-faint"
            />
            <Button intent="ghost" size="icon" aria-label="Zamknij wyszukiwanie" onClick={() => (setQuery(''), setSearching(false))}>
              <X className="size-4" />
            </Button>
          </div>
        ) : (
          <>
            <span className="text-xs font-semibold tracking-wide uppercase">Napisy</span>
            <span className="font-mono text-[11px] text-faint tabular-nums">{cues.length}</span>
            <div className="flex-1" />
            <Button intent="ghost" size="icon" aria-label="Szukaj" onClick={() => setSearching(true)}>
              <Search className="size-4" />
            </Button>
          </>
        )}
      </div>

      <label className="flex shrink-0 items-center gap-3 border-b border-border px-3 py-2.5">
        <span className="text-xs whitespace-nowrap text-muted">Znaków na napis</span>
        <input
          type="range"
          min={6}
          max={60}
          value={maxChars}
          disabled={cues.length === 0}
          onChange={(e) => useProject.getState().setMaxChars(Number(e.target.value))}
          className="min-w-0 flex-1 accent-brand"
        />
        <span className="w-6 text-right font-mono text-xs tabular-nums">{maxChars}</span>
      </label>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {visible.map((cue) => (
          <CueRow key={cue.id} cue={cue} active={cue.id === activeId} selected={cue.id === selectedId} />
        ))}
        {cues.length === 0 && (
          <p className="px-4 py-8 text-center text-xs text-pretty text-muted">
            Tu pojawią się napisy po automatycznej transkrypcji. Możesz też dodać je ręcznie.
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => useProject.getState().addCueAt(useProject.getState().playhead)}
        className="flex h-10 shrink-0 items-center justify-center gap-1.5 border-t border-border text-xs font-medium text-muted outline-none hover:bg-surface-raised hover:text-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/70"
      >
        <Plus className="size-3.5" /> Dodaj napis w miejscu głowicy
      </button>
    </div>
  )
}
