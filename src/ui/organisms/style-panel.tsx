import { memo, useState, type FC } from 'react'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDownToLine,
  ArrowUpToLine,
  Bold,
  FoldVertical,
  Italic,
  Plus,
  Underline,
} from 'lucide-react'
import { useProject } from '@/store/project'
import { cn } from '@/lib/cn'
import type { StylePreset, SubtitleStyle } from '@/lib/types'
import { PanelSection } from '@/ui/atoms/panel-section'
import { Segmented } from '@/ui/atoms/segmented'
import { Slider } from '@/ui/atoms/slider'
import { ColorField } from '@/ui/atoms/color-field'
import { Button } from '@/ui/atoms/button'

const FONTS = ['Montserrat', 'IBM Plex Sans', 'Arial', 'Verdana', 'Georgia', 'Impact', 'Trebuchet MS']

const Toggle: FC<{ on: boolean; label: string; onChange: (v: boolean) => void }> = ({ on, label, onChange }) => (
  <label className="flex cursor-pointer items-center justify-between gap-3">
    <span className="text-xs text-muted">{label}</span>
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={cn(
        'relative h-5 w-9 rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand/70',
        on ? 'bg-brand' : 'bg-border-strong',
      )}
    >
      <span className={cn('absolute top-0.5 left-0.5 size-4 rounded-full bg-foreground transition-transform', on && 'translate-x-4')} />
    </button>
  </label>
)

const PresetCard: FC<{ preset: StylePreset; active: boolean; onApply: () => void }> = memo(({ preset, active, onApply }) => {
  const s = preset.style
  const textStyle = {
    fontFamily: `'${s.font}', sans-serif`,
    fontWeight: s.bold ? 800 : 500,
    fontStyle: s.italic ? 'italic' : 'normal',
    color: s.color,
    textTransform: s.textCase === 'upper' ? 'uppercase' : s.textCase === 'lower' ? 'lowercase' : 'none',
    textShadow:
      s.outline.width > 0
        ? `1px 1px 0 ${s.outline.color}, -1px 1px 0 ${s.outline.color}, 1px -1px 0 ${s.outline.color}, -1px -1px 0 ${s.outline.color}`
        : s.shadow.distance > 0
          ? `1px 1px 2px ${s.shadow.color}`
          : undefined,
    background: s.bg.opacity > 0 ? `${s.bg.color}${Math.round(s.bg.opacity * 255).toString(16).padStart(2, '0')}` : undefined,
    padding: s.bg.opacity > 0 ? '1px 5px' : undefined,
    borderRadius: 4,
    boxDecorationBreak: 'clone',
    WebkitBoxDecorationBreak: 'clone',
  } as const
  return (
    <button
      type="button"
      onClick={onApply}
      aria-pressed={active}
      className="group grid gap-1.5 text-left outline-none"
    >
      <span
        className={cn(
          'grid aspect-[4/3] place-items-center rounded-md border bg-canvas px-2 text-center text-[13px] leading-[1.35] transition-[border-color,transform] group-active:scale-[0.97]',
          active ? 'border-brand' : 'border-border group-hover:border-border-strong',
          'group-focus-visible:ring-2 group-focus-visible:ring-brand/70',
        )}
      >
        <span style={textStyle}>
          Twoje <span style={{ color: s.highlightActiveWord ? s.activeWordColor : s.color }}>napisy</span> tutaj
        </span>
      </span>
      <span className={cn('text-[11px]', active ? 'text-foreground' : 'text-muted')}>{preset.name}</span>
    </button>
  )
})
PresetCard.displayName = 'PresetCard'

export const StylePanel: FC = () => {
  const style = useProject((s) => s.style)
  const presets = useProject((s) => s.presets)
  const { setStyle, applyStyle, savePreset } = useProject.getState()
  const [naming, setNaming] = useState<string | null>(null)
  const set = <K extends keyof SubtitleStyle>(key: K, value: SubtitleStyle[K]) => setStyle({ [key]: value } as Partial<SubtitleStyle>)
  const activePresetId = presets.find((p) => JSON.stringify(p.style) === JSON.stringify(style))?.id

  return (
    <div className="h-full overflow-y-auto bg-surface">
      <PanelSection title="Style gotowe">
        <div className="grid grid-cols-2 gap-3">
          {presets.map((p) => (
            <PresetCard key={p.id} preset={p} active={p.id === activePresetId} onApply={() => applyStyle(p.style)} />
          ))}
        </div>
        {naming === null ? (
          <Button size="sm" onClick={() => setNaming('')}>
            <Plus className="size-3.5" /> Zapisz bieżący styl
          </Button>
        ) : (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (naming.trim()) savePreset(naming.trim())
              setNaming(null)
            }}
          >
            <input
              autoFocus
              type="text"
              value={naming}
              placeholder="Nazwa stylu"
              onChange={(e) => setNaming(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              className="h-7 min-w-0 flex-1 rounded-md bg-surface-raised px-2 text-xs outline-none focus:ring-1 focus:ring-brand"
            />
            <Button size="sm" intent="primary" type="submit">
              Zapisz
            </Button>
          </form>
        )}
      </PanelSection>

      <PanelSection title="Czcionka">
        <div className="grid grid-cols-[1fr_5rem] gap-2">
          <select
            value={style.font}
            aria-label="Krój czcionki"
            onChange={(e) => set('font', e.target.value)}
            className="h-8 rounded-md bg-surface-raised px-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-brand/70"
          >
            {FONTS.map((f) => (
              <option key={f} value={f} style={{ fontFamily: f }}>
                {f}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={12}
            max={200}
            value={style.size}
            aria-label="Rozmiar czcionki"
            onChange={(e) => set('size', Math.max(12, Math.min(200, Number(e.target.value) || 12)))}
            onKeyDown={(e) => e.stopPropagation()}
            className="h-8 rounded-md bg-surface-raised px-2 font-mono text-[13px] tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-brand/70"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="inline-flex rounded-md bg-surface-raised p-0.5">
            {(
              [
                ['bold', Bold, 'Pogrubienie'],
                ['italic', Italic, 'Kursywa'],
                ['underline', Underline, 'Podkreślenie'],
              ] as const
            ).map(([key, Icon, label]) => (
              <button
                key={key}
                type="button"
                aria-label={label}
                aria-pressed={style[key]}
                onClick={() => set(key, !style[key])}
                className={cn(
                  'grid size-7 place-items-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-brand/70',
                  style[key] ? 'bg-brand text-on-brand' : 'text-muted hover:text-foreground',
                )}
              >
                <Icon className="size-3.5" />
              </button>
            ))}
          </div>
          <Segmented
            value={style.textCase}
            onChange={(v) => set('textCase', v)}
            options={[
              { value: 'upper', label: 'AA', title: 'Wielkie litery' },
              { value: 'none', label: 'Aa', title: 'Bez zmian' },
              { value: 'lower', label: 'aa', title: 'Małe litery' },
            ]}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Segmented
            value={style.align}
            onChange={(v) => set('align', v)}
            options={[
              { value: 'left', label: <AlignLeft className="size-3.5" />, title: 'Do lewej' },
              { value: 'center', label: <AlignCenter className="size-3.5" />, title: 'Do środka' },
              { value: 'right', label: <AlignRight className="size-3.5" />, title: 'Do prawej' },
            ]}
          />
          <Segmented
            value={style.vAlign}
            onChange={(v) => set('vAlign', v)}
            options={[
              { value: 'top', label: <ArrowUpToLine className="size-3.5" />, title: 'Góra' },
              { value: 'middle', label: <FoldVertical className="size-3.5" />, title: 'Środek' },
              { value: 'bottom', label: <ArrowDownToLine className="size-3.5" />, title: 'Dół' },
            ]}
          />
        </div>
        <Slider label="Interlinia" value={style.lineHeight} min={0.8} max={2} step={0.1} suffix="x" onChange={(v) => set('lineHeight', v)} />
        <Slider label="Od krawędzi" value={style.marginV} min={0} max={900} step={10} suffix="px" onChange={(v) => set('marginV', v)} />
      </PanelSection>

      <PanelSection title="Kolor">
        <ColorField label="Tekst" value={style.color} onChange={(v) => set('color', v)} />
        <Toggle label="Podświetlaj wypowiadane słowo" on={style.highlightActiveWord} onChange={(v) => set('highlightActiveWord', v)} />
        {style.highlightActiveWord && (
          <ColorField label="Aktywne słowo" value={style.activeWordColor} onChange={(v) => set('activeWordColor', v)} />
        )}
      </PanelSection>

      <PanelSection title="Tło">
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <ColorField label="Kolor tła" value={style.bg.color} onChange={(v) => setStyle({ bg: { ...style.bg, color: v } })} />
          </div>
        </div>
        <Segmented
          value={style.bg.mode}
          onChange={(v) => setStyle({ bg: { ...style.bg, mode: v } })}
          options={[
            { value: 'wrap', label: 'Pod tekstem', title: 'Tło dopasowane do linii' },
            { value: 'fill', label: 'Blok', title: 'Jeden blok tła' },
          ]}
        />
        <Slider label="Krycie" value={Math.round(style.bg.opacity * 100)} min={0} max={100} suffix="%" onChange={(v) => setStyle({ bg: { ...style.bg, opacity: v / 100 } })} />
        <Slider label="Narożniki" value={style.bg.corners} min={0} max={50} suffix="%" onChange={(v) => setStyle({ bg: { ...style.bg, corners: v } })} />
        <Slider label="Margines" value={style.bg.padding} min={0} max={40} suffix="px" onChange={(v) => setStyle({ bg: { ...style.bg, padding: v } })} />
      </PanelSection>

      <PanelSection title="Obrys i cień">
        <ColorField label="Obrys" value={style.outline.color} onChange={(v) => setStyle({ outline: { ...style.outline, color: v } })} />
        <Slider label="Grubość" value={style.outline.width} min={0} max={12} suffix="px" onChange={(v) => setStyle({ outline: { ...style.outline, width: v } })} />
        <ColorField label="Cień" value={style.shadow.color} onChange={(v) => setStyle({ shadow: { ...style.shadow, color: v } })} />
        <Slider label="Odległość" value={style.shadow.distance} min={0} max={12} suffix="px" onChange={(v) => setStyle({ shadow: { ...style.shadow, distance: v } })} />
      </PanelSection>

      <PanelSection title="Animacja">
        <Segmented
          value={style.animation}
          onChange={(v) => set('animation', v)}
          options={[
            { value: 'none', label: 'Brak' },
            { value: 'growing', label: 'Wzrost' },
          ]}
        />
      </PanelSection>
    </div>
  )
}
