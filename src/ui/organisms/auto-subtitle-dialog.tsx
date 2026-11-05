import { useEffect, useState, type FC } from 'react'
import { X } from 'lucide-react'
import { useProject } from '@/store/project'
import { hasApiKey, setApiKey, transcribe, type CloudProvider, type TranscribeProgress } from '@/lib/bridge'
import { regroupWords } from '@/lib/regroup'
import type { SttEngineId } from '@/lib/types'
import { Button } from '@/ui/atoms/button'

const LANGUAGES = [
  ['pl', 'Polski'],
  ['en', 'Angielski'],
  ['de', 'Niemiecki'],
  ['uk', 'Ukraiński'],
  ['es', 'Hiszpański'],
  ['fr', 'Francuski'],
  ['auto', 'Wykryj automatycznie'],
] as const

const ENGINES: Record<SttEngineId, { label: string; hint: string; models: string[] }> = {
  'faster-whisper': {
    label: 'faster-whisper (lokalnie, GPU)',
    hint: 'Offline, na Twojej karcie graficznej. Najlepszy wybór dla polskiego.',
    models: ['large-v3', 'large-v3-turbo', 'medium', 'small', 'base'],
  },
  whisperx: {
    label: 'WhisperX (lokalnie, precyzyjne słowa)',
    hint: 'Dokładniejsze granice słów dzięki wyrównaniu. Wolniejsza pierwsza instalacja.',
    models: ['large-v3', 'medium', 'small'],
  },
  openai: {
    label: 'OpenAI (chmura)',
    hint: 'Wymaga klucza API. Audio jest wysyłane do OpenAI.',
    models: ['whisper-1'],
  },
  deepgram: {
    label: 'Deepgram (chmura)',
    hint: 'Wymaga klucza API. Audio jest wysyłane do Deepgram.',
    models: ['nova-3', 'nova-2'],
  },
}

const ApiKeyField: FC<{ provider: CloudProvider; disabled: boolean }> = ({ provider, disabled }) => {
  const [saved, setSaved] = useState<boolean | null>(null)
  const [draft, setDraft] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    setDraft('')
    setMessage(null)
    hasApiKey(provider).then(setSaved, () => setSaved(false))
  }, [provider])

  const save = async () => {
    try {
      await setApiKey(provider, draft)
      setSaved(draft.trim().length > 0)
      setDraft('')
      setMessage(draft.trim() ? 'Klucz zapisany w Menedżerze poświadczeń Windows.' : 'Klucz usunięty.')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="grid gap-1.5">
      <span className="flex justify-between text-xs text-muted">
        Klucz API
        <span className={saved ? 'text-brand' : 'text-faint'}>{saved ? 'zapisany' : 'brak'}</span>
      </span>
      <div className="flex gap-2">
        <input
          type="password"
          value={draft}
          disabled={disabled}
          autoComplete="off"
          placeholder={saved ? 'Wpisz nowy, aby zastąpić' : 'Wklej klucz'}
          onChange={(e) => setDraft(e.target.value)}
          className={fieldClass}
        />
        <Button size="lg" onClick={save} disabled={disabled || (!draft && !saved)}>
          {draft || !saved ? 'Zapisz' : 'Usuń'}
        </Button>
      </div>
      {message && <span className="text-[11px] text-faint">{message}</span>}
    </div>
  )
}

const fieldClass =
  'h-10 w-full rounded-md border border-border bg-surface-raised px-3 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-brand/70'

export const AutoSubtitleDialog: FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const stt = useProject((s) => s.stt)
  const video = useProject((s) => s.video)
  const [progress, setProgress] = useState<TranscribeProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const running = progress !== null

  useEffect(() => {
    if (!open) return
    setError(null)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !running && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, running, onClose])

  if (!open || !video) return null
  const engine = ENGINES[stt.engine]

  const run = async () => {
    setError(null)
    setProgress({ stage: 'Przygotowanie', percent: 0 })
    try {
      const words = await transcribe(video, stt, setProgress)
      if (words.length === 0) throw new Error('Nie rozpoznano mowy w tym nagraniu.')
      const state = useProject.getState()
      state.setCues(regroupWords(words, state.maxChars))
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setProgress(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-6" onMouseDown={() => !running && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auto-sub-title"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        className="grid w-full max-w-md animate-enter gap-5 rounded-lg border border-border bg-surface p-6 shadow-2xl shadow-black/50"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="grid gap-1">
            <h2 id="auto-sub-title" className="text-base font-semibold">
              Automatyczne napisy
            </h2>
            <p className="text-xs text-muted">Rozpoznamy mowę i rozłożymy napisy na osi czasu.</p>
          </div>
          <Button intent="ghost" size="icon" aria-label="Zamknij" onClick={onClose} disabled={running}>
            <X className="size-4" />
          </Button>
        </div>

        <label className="grid gap-1.5">
          <span className="text-xs text-muted">Język nagrania</span>
          <select className={fieldClass} value={stt.language} disabled={running} onChange={(e) => useProject.getState().setStt({ language: e.target.value })}>
            {LANGUAGES.map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1.5">
          <span className="text-xs text-muted">Silnik rozpoznawania mowy</span>
          <select
            className={fieldClass}
            value={stt.engine}
            disabled={running}
            onChange={(e) => {
              const id = e.target.value as SttEngineId
              useProject.getState().setStt({ engine: id, model: ENGINES[id].models[0] ?? '' })
            }}
          >
            {(Object.keys(ENGINES) as SttEngineId[]).map((id) => (
              <option key={id} value={id}>
                {ENGINES[id].label}
              </option>
            ))}
          </select>
          <span className="text-[11px] text-pretty text-faint">{engine.hint}</span>
        </label>

        <label className="grid gap-1.5">
          <span className="text-xs text-muted">Model</span>
          <select className={fieldClass} value={stt.model} disabled={running} onChange={(e) => useProject.getState().setStt({ model: e.target.value })}>
            {engine.models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>

        {(stt.engine === 'openai' || stt.engine === 'deepgram') && <ApiKeyField provider={stt.engine} disabled={running} />}

        <label className="grid gap-1.5 opacity-50">
          <span className="text-xs text-muted">Tłumaczenie</span>
          <select className={fieldClass} disabled>
            <option>Bez tłumaczenia, język oryginału</option>
          </select>
        </label>

        {running && (
          <div className="grid gap-2" aria-live="polite">
            <div className="flex justify-between text-xs">
              <span>{progress.stage}</span>
              <span className="font-mono tabular-nums text-muted">{Math.round(progress.percent)}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-raised">
              <div className="h-full rounded-full bg-brand transition-[width] duration-300" style={{ width: `${progress.percent}%` }} />
            </div>
          </div>
        )}
        {error && <p className="rounded-md bg-danger/10 px-3 py-2 text-xs text-pretty text-danger">{error}</p>}

        <div className="grid gap-2">
          <Button intent="primary" size="lg" full onClick={run} disabled={running}>
            {running ? 'Generowanie…' : 'Generuj napisy'}
          </Button>
          <Button intent="ghost" size="lg" full onClick={onClose} disabled={running}>
            Anuluj
          </Button>
        </div>
      </div>
    </div>
  )
}
