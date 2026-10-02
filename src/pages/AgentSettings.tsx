import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle, Loader2, Play, RotateCcw, Square } from 'lucide-react'
import { api } from '../lib/api'
import { useUIStore } from '../store/uistore'
import { Button } from '../components/ui/Button'

type Kind = 'stt' | 'llm' | 'tts' | 'realtime'
type ModelType = 'standard' | 'realtime'

/** One stage's choice. Which of these a provider actually uses is told by its `config_fields`. */
type Stage = { provider?: string; model?: string; language?: string; voice?: string; temperature?: number }

type AgentSettings = {
  first_message: string
  system_prompt: string
  model_type: ModelType
  is_customised: boolean
  stt: Stage
  llm: Stage
  tts: Stage
  realtime: Stage
  defaults: { first_message: string; system_prompt: string }
  owner_clinic: { id: number; name: string }
  catalog_available: boolean
  preview_providers: string[]
}

type Option = { id: string; label?: string; gender?: string; language?: string; description?: string }
type ProviderSummary = { name: string; description: string }
type CatalogModel = { id: string; label?: string; languages?: { code: string; label?: string }[]; voices?: Option[] }
type ProviderEntry = { description?: string; config_fields?: Record<string, string>; models?: CatalogModel[] }

const KINDS: Kind[] = ['stt', 'llm', 'tts', 'realtime']
const STAGE_TITLE: Record<Kind, { title: string; hint: string }> = {
  stt: { title: 'Speech to text', hint: 'Turns what the caller says into text.' },
  llm: { title: 'Language model', hint: 'Decides what the receptionist says and when to use its tools.' },
  tts: { title: 'Text to speech', hint: 'The voice the caller hears.' },
  realtime: { title: 'Realtime model', hint: 'One speech-to-speech model that listens, thinks and speaks.' },
}
const NO_VOICES: Option[] = []
const inputClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-400'

function errorMessage(err: any, fallback: string) {
  const data = err?.response?.data
  if (typeof data?.detail === 'string') return data.detail
  if (data && typeof data === 'object') {
    const first = Object.values(data)[0]
    if (typeof first === 'string') return first
    if (Array.isArray(first) && typeof first[0] === 'string') return first[0]
  }
  return fallback
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</span>
      {children}
    </label>
  )
}

/** A provider's full catalog entry (models, languages, config fields), loaded when it is chosen. */
function useProviderEntry(kind: Kind, provider: string | undefined) {
  const [entry, setEntry] = useState<ProviderEntry | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    setEntry(null)
    setError('')
    if (!provider) return
    let cancelled = false
    api.get('/ai/voice-agent/providers/', { params: { type: kind, provider } })
      .then((res) => { if (!cancelled) setEntry(res.data) })
      .catch((err) => { if (!cancelled) setError(errorMessage(err, 'Could not load this provider.')) })
    return () => { cancelled = true }
  }, [kind, provider])
  return { entry, error }
}

function StageEditor({
  kind, stage, providers, error, previewProviders, onChange,
}: {
  kind: Kind
  stage: Stage
  providers: ProviderSummary[]
  error?: string
  previewProviders: string[]
  onChange: (stage: Stage) => void
}) {
  const { addToast } = useUIStore()
  const { entry, error: loadError } = useProviderEntry(kind, stage.provider)
  const fields = entry?.config_fields ?? {}
  const models = entry?.models ?? []
  const model = models.find((m) => m.id === stage.model)
  const languages = model?.languages ?? []

  // Text-to-speech voices come from their own endpoint; realtime voices are listed on the model.
  const [ttsVoices, setTtsVoices] = useState<Option[]>([])
  const [voicesLoading, setVoicesLoading] = useState(false)
  const [voiceFilter, setVoiceFilter] = useState('')
  const needsModel = 'model' in fields && models.length > 0
  useEffect(() => {
    setTtsVoices([])
    if (kind !== 'tts' || !stage.provider || !entry || !('voice' in fields) || (needsModel && !model)) return
    let cancelled = false
    setVoicesLoading(true)
    api.get('/ai/voice-agent/voices/', { params: { provider: stage.provider, model: needsModel ? stage.model : undefined } })
      .then((res) => { if (!cancelled) setTtsVoices(res.data.voices ?? []) })
      .catch(() => { if (!cancelled) setTtsVoices([]) })
      .finally(() => { if (!cancelled) setVoicesLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, stage.provider, stage.model, entry])

  const voices = kind === 'tts' ? ttsVoices : model?.voices ?? NO_VOICES
  const shownVoices = useMemo(() => {
    const query = voiceFilter.trim().toLowerCase()
    const matches = query
      ? voices.filter((v) => `${v.label ?? ''} ${v.id} ${v.gender ?? ''} ${v.language ?? ''}`.toLowerCase().includes(query))
      : voices
    // Keep the saved voice selectable even when the filter hides it.
    const current = voices.find((v) => v.id === stage.voice)
    return current && !matches.includes(current) ? [current, ...matches] : matches
  }, [voices, voiceFilter, stage.voice])

  // A model fixes which languages are valid: drop a language the new model does not support.
  useEffect(() => {
    if (stage.language && languages.length > 0 && !languages.some((l) => l.code === stage.language)) {
      onChange({ ...stage, language: '' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage.model, languages.length])

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [previewing, setPreviewing] = useState<'idle' | 'loading' | 'playing'>('idle')
  useEffect(() => () => audioRef.current?.pause(), [])
  const canPreview = kind === 'tts' && !!stage.provider && previewProviders.includes(stage.provider)
  const togglePreview = async () => {
    if (previewing !== 'idle') {
      audioRef.current?.pause()
      setPreviewing('idle')
      return
    }
    setPreviewing('loading')
    try {
      const res = await api.post('/ai/voice-agent/preview/', {
        provider: stage.provider, model: stage.model, voice: stage.voice, language: stage.language,
      }, { responseType: 'blob' })
      const audio = new Audio(URL.createObjectURL(res.data))
      audioRef.current = audio
      audio.onended = () => setPreviewing('idle')
      await audio.play()
      setPreviewing('playing')
    } catch {
      setPreviewing('idle')
      addToast('Could not play a sample of this voice.', 'error')
    }
  }

  const description = providers.find((p) => p.name === stage.provider)?.description
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <h4 className="text-sm font-semibold text-slate-900">{STAGE_TITLE[kind].title}</h4>
      <p className="mt-0.5 text-xs text-slate-500">{STAGE_TITLE[kind].hint}</p>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Provider">
          <select
            className={inputClass}
            value={stage.provider ?? ''}
            onChange={(e) => onChange({ provider: e.target.value, temperature: stage.temperature })}
          >
            <option value="">Choose a provider</option>
            {stage.provider && !providers.some((p) => p.name === stage.provider) && <option value={stage.provider}>{stage.provider}</option>}
            {providers.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
          </select>
        </Field>

        {'model' in fields && models.length > 0 && (
          <Field label="Model">
            <select className={inputClass} value={stage.model ?? ''} onChange={(e) => onChange({ ...stage, model: e.target.value, voice: '' })}>
              <option value="">Choose a model</option>
              {models.map((m) => <option key={m.id} value={m.id}>{m.label || m.id}</option>)}
            </select>
          </Field>
        )}

        {'language' in fields && (
          <Field label="Language">
            {languages.length > 0 ? (
              <select className={inputClass} value={stage.language ?? ''} onChange={(e) => onChange({ ...stage, language: e.target.value })}>
                <option value="">Provider default</option>
                {languages.map((l) => <option key={l.code} value={l.code}>{l.label ? `${l.label} (${l.code})` : l.code}</option>)}
              </select>
            ) : (
              <input
                className={inputClass}
                placeholder="Language code, e.g. en"
                value={stage.language ?? ''}
                onChange={(e) => onChange({ ...stage, language: e.target.value })}
              />
            )}
          </Field>
        )}

        {kind === 'llm' && stage.provider && (
          <Field label={`Temperature (${(stage.temperature ?? 0.3).toFixed(1)})`}>
            <input
              type="range" min={0} max={2} step={0.1}
              className="mt-2 w-full accent-slate-900"
              value={stage.temperature ?? 0.3}
              onChange={(e) => onChange({ ...stage, temperature: Number(e.target.value) })}
            />
          </Field>
        )}

        {'voice' in fields && (
          <div className="sm:col-span-2">
            <Field label="Voice">
              <div className="flex flex-col gap-2 sm:flex-row">
                {voices.length > 30 && (
                  <input
                    className={`${inputClass} sm:w-56`}
                    placeholder={`Filter ${voices.length} voices`}
                    value={voiceFilter}
                    onChange={(e) => setVoiceFilter(e.target.value)}
                  />
                )}
                {voices.length > 0 ? (
                  <select className={inputClass} value={stage.voice ?? ''} onChange={(e) => onChange({ ...stage, voice: e.target.value })}>
                    <option value="">Choose a voice</option>
                    {stage.voice && !voices.some((v) => v.id === stage.voice) && <option value={stage.voice}>{stage.voice}</option>}
                    {shownVoices.map((v) => (
                      <option key={v.id} value={v.id}>
                        {[v.label || v.id, v.gender, v.language].filter(Boolean).join(' · ')}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className={inputClass}
                    placeholder={voicesLoading ? 'Loading voices…' : 'Voice id'}
                    value={stage.voice ?? ''}
                    onChange={(e) => onChange({ ...stage, voice: e.target.value })}
                  />
                )}
                {canPreview && (
                  <Button type="button" variant="outline" className="h-auto shrink-0 px-3 py-2" disabled={!stage.voice || !stage.model || previewing === 'loading'} onClick={togglePreview}>
                    {previewing === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" /> : previewing === 'playing' ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    {previewing === 'playing' ? 'Stop' : 'Listen'}
                  </Button>
                )}
              </div>
            </Field>
          </div>
        )}
      </div>

      {description && <p className="mt-3 text-xs leading-relaxed text-slate-500">{description}</p>}
      {(error || loadError) && <p className="mt-3 text-xs font-medium text-red-600">{error || loadError}</p>}
    </div>
  )
}

/** The AI receptionist tab of Settings: its greeting, instructions and the models it runs on. */
export default function AgentSettingsPage() {
  const { addToast } = useUIStore()
  const [settings, setSettings] = useState<AgentSettings | null>(null)
  const [loadError, setLoadError] = useState('')
  const [providers, setProviders] = useState<Record<Kind, ProviderSummary[]>>({ stt: [], llm: [], tts: [], realtime: [] })
  const [catalogError, setCatalogError] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get('/ai/voice-agent/')
      .then((res) => setSettings(res.data))
      .catch((err) => setLoadError(errorMessage(err, 'Could not load the AI receptionist settings.')))
    Promise.all(KINDS.map((kind) => api.get('/ai/voice-agent/providers/', { params: { type: kind } })))
      .then((responses) => setProviders(Object.fromEntries(responses.map((res, i) => [KINDS[i], res.data.providers ?? []])) as Record<Kind, ProviderSummary[]>))
      .catch((err) => setCatalogError(errorMessage(err, 'Could not load the list of voice providers.')))
  }, [])

  if (loadError) return <p className="text-sm text-red-600">{loadError}</p>
  if (!settings) return <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>

  const update = (patch: Partial<AgentSettings>) => setSettings({ ...settings, ...patch })
  const stages: Kind[] = settings.model_type === 'realtime' ? ['realtime'] : ['stt', 'llm', 'tts']

  const save = async () => {
    setSaving(true)
    setErrors({})
    try {
      const { first_message, system_prompt, model_type, stt, llm, tts, realtime } = settings
      const res = await api.put('/ai/voice-agent/', { first_message, system_prompt, model_type, stt, llm, tts, realtime })
      setSettings(res.data)
      addToast('AI receptionist settings saved. They apply from the next call.', 'success')
    } catch (err: any) {
      const data = err?.response?.data
      if (err?.response?.status === 400 && data && typeof data === 'object') setErrors(data)
      addToast(errorMessage(err, 'Could not save the settings.'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const reset = async () => {
    if (!window.confirm('Discard your greeting, instructions and model choices and go back to the defaults?')) return
    setSaving(true)
    setErrors({})
    try {
      const res = await api.delete('/ai/voice-agent/')
      setSettings(res.data)
      addToast('Back to the default settings.', 'success')
    } catch (err) {
      addToast(errorMessage(err, 'Could not reset the settings.'), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-900">AI receptionist</h3>
        <p className="mt-1 text-sm text-slate-500">
          What the receptionist says and the models it runs on, for {settings.owner_clinic.name} and its centres.
        </p>
      </div>

      {(!settings.catalog_available || catalogError) && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {settings.catalog_available ? catalogError : 'The voice provider is not connected (ROCK8_API_KEY is missing), so models and voices cannot be listed.'}
        </div>
      )}

      <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Greeting and instructions</h3>
          <p className="mt-1 text-sm text-slate-500">
            Write <code className="rounded bg-slate-100 px-1 text-xs">{'{clinic_name}'}</code> where the clinic's name should appear.
          </p>
        </div>

        <Field label="Greeting">
          <textarea
            className={`${inputClass} min-h-[64px]`}
            value={settings.first_message}
            onChange={(e) => update({ first_message: e.target.value })}
          />
          {errors.first_message && <p className="mt-1 text-xs font-medium text-red-600">{errors.first_message}</p>}
        </Field>

        <Field label="Instructions (system prompt)">
          <textarea
            className={`${inputClass} min-h-[260px] leading-relaxed`}
            value={settings.system_prompt}
            onChange={(e) => update({ system_prompt: e.target.value })}
          />
          {errors.system_prompt && <p className="mt-1 text-xs font-medium text-red-600">{errors.system_prompt}</p>}
        </Field>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-slate-500">
            Today's date, the caller's number and each centre's details are added to the instructions automatically.
          </p>
          <button
            type="button"
            className="text-xs font-semibold text-slate-700 underline-offset-2 hover:underline disabled:opacity-40"
            disabled={settings.system_prompt === settings.defaults.system_prompt && settings.first_message === settings.defaults.first_message}
            onClick={() => update({ ...settings.defaults })}
          >
            Use the default greeting and instructions
          </button>
        </div>
      </div>

      <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Models</h3>
          <p className="mt-1 text-sm text-slate-500">Choose how the receptionist hears, thinks and speaks.</p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {([
            { id: 'standard', title: 'Standard', text: 'Separate speech-to-text, language model and text-to-speech. Widest choice of voices and languages.' },
            { id: 'realtime', title: 'Realtime', text: 'One speech-to-speech model. More natural turn-taking, with the voices that model offers.' },
          ] as { id: ModelType; title: string; text: string }[]).map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => update({ model_type: option.id })}
              className={`rounded-xl border-2 p-4 text-left transition-colors ${
                settings.model_type === option.id ? 'border-slate-900 bg-slate-50' : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <span className="block text-sm font-semibold text-slate-900">{option.title}</span>
              <span className="mt-1 block text-xs leading-relaxed text-slate-500">{option.text}</span>
            </button>
          ))}
        </div>
        {errors.model_type && <p className="text-xs font-medium text-red-600">{errors.model_type}</p>}

        {stages.map((kind) => (
          <StageEditor
            key={kind}
            kind={kind}
            stage={settings[kind]}
            providers={providers[kind]}
            error={errors[kind]}
            previewProviders={settings.preview_providers}
            onChange={(stage) => update({ [kind]: stage } as Partial<AgentSettings>)}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="ghost" disabled={saving || !settings.is_customised} onClick={reset}>
          <RotateCcw className="h-4 w-4" /> Reset everything to defaults
        </Button>
        <Button type="button" variant="default" className="h-9 px-4" disabled={saving} onClick={save}>
          {saving ? 'Saving…' : 'Save settings'}
        </Button>
      </div>
    </div>
  )
}
