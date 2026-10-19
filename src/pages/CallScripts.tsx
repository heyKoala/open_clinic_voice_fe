import { useEffect, useRef, useState } from 'react'
import { ChevronDown, RotateCcw } from 'lucide-react'
import { apiErrorMessage } from '../lib/appointments'
import { getCallSettings, saveCallSettings, type PatientCallKind, type PatientCallSettings } from '../lib/patientCalls'
import { Button } from '../components/ui/Button'
import { toast } from '../components/shadcn/toast'

const input = 'w-full rounded-xl border border-slate-300 bg-white px-3 text-sm'

const KINDS: { kind: PatientCallKind; title: string; hint: string }[] = [
  { kind: 'reminder', title: 'Reminder call', hint: 'The day before the appointment: remind the patient and ask if they will come.' },
  { kind: 'feedback', title: 'Feedback call', hint: 'After the visit: ask how it went, for a rating from 1 to 5, and for a Google review if it went well.' },
]

type Draft = Record<PatientCallKind, { first_message: string; script: string }>

/**
 * What the AI says when it calls patients (reminder and feedback calls). The hospital writes the conversation;
 * how the AI saves the result is added by the system on every call and shown here read-only.
 */
export default function CallScripts() {
  const [settings, setSettings] = useState<PatientCallSettings | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)
  const [openSystem, setOpenSystem] = useState<PatientCallKind | null>(null)
  const textareas = useRef<Partial<Record<PatientCallKind, HTMLTextAreaElement | null>>>({})

  const fromSettings = (s: PatientCallSettings): Draft => ({
    reminder: {
      first_message: s.reminder_first_message || s.script_defaults?.reminder.first_message || '',
      script: s.reminder_script || s.script_defaults?.reminder.script || '',
    },
    feedback: {
      first_message: s.feedback_first_message || s.script_defaults?.feedback.first_message || '',
      script: s.feedback_script || s.script_defaults?.feedback.script || '',
    },
  })

  useEffect(() => {
    getCallSettings()
      .then((s) => { setSettings(s); setDraft(fromSettings(s)) })
      .catch(() => toast.add({ title: 'Could not load the call scripts.', type: 'error' }))
  }, [])

  if (!settings || !draft) return <p className="text-sm text-slate-500">Loading…</p>

  const set = (kind: PatientCallKind, key: 'first_message' | 'script', value: string) =>
    setDraft({ ...draft, [kind]: { ...draft[kind], [key]: value } })

  const insert = (kind: PatientCallKind, token: string) => {
    const el = textareas.current[kind]
    const text = draft[kind].script
    const at = el ? el.selectionStart : text.length
    set(kind, 'script', text.slice(0, at) + token + text.slice(el ? el.selectionEnd : text.length))
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(at + token.length, at + token.length) })
  }

  const isDefault = (kind: PatientCallKind) =>
    draft[kind].script === settings.script_defaults?.[kind].script && draft[kind].first_message === settings.script_defaults?.[kind].first_message

  const save = async () => {
    setBusy(true)
    try {
      const saved = await saveCallSettings({
        reminder_first_message: draft.reminder.first_message, reminder_script: draft.reminder.script,
        feedback_first_message: draft.feedback.first_message, feedback_script: draft.feedback.script,
      })
      setSettings(saved); setDraft(fromSettings(saved))
      toast.add({ title: 'Call scripts saved. The next calls use them.', type: 'success' })
    } catch (err) {
      toast.add({ title: apiErrorMessage(err, 'Could not save the scripts.'), type: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const placeholders = Object.entries(settings.script_placeholders ?? {})

  return (
    <div className="max-w-4xl space-y-6">
      <p className="text-sm text-slate-500">
        What the AI receptionist says when it calls patients. Write it in plain words. Words in braces, like{' '}
        <code className="rounded bg-slate-100 px-1 text-xs">{'{patient_name}'}</code>, are filled in for each call.
        When and how often these calls are made is under Settings → Reminders &amp; feedback.
      </p>

      {KINDS.map(({ kind, title, hint }) => (
        <section key={kind} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-slate-900">{title}</h2>
              <p className="mt-0.5 text-sm text-slate-500">{hint}</p>
            </div>
            {!isDefault(kind) && settings.script_defaults && (
              <Button size="sm" variant="ghost" onClick={() => setDraft({ ...draft, [kind]: { ...settings.script_defaults![kind] } })}>
                <RotateCcw /> Use the default
              </Button>
            )}
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-700">First thing the AI says</span>
            <input className={`${input} h-10`} value={draft[kind].first_message} maxLength={500}
              onChange={(e) => set(kind, 'first_message', e.target.value)} />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-700">How the conversation goes</span>
            <textarea
              ref={(el) => { textareas.current[kind] = el }}
              className={`${input} py-2 font-mono text-[13px] leading-relaxed`}
              rows={14}
              style={{ minHeight: 280 }}
              value={draft[kind].script}
              maxLength={8000}
              onChange={(e) => set(kind, 'script', e.target.value)}
            />
          </label>

          {placeholders.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-slate-500">Insert:</span>
              {placeholders.map(([key, label]) => (
                <button key={key} type="button" title={label} onClick={() => insert(kind, `{${key}}`)}
                  className="!min-h-0 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[11px] text-slate-700 hover:border-slate-300">
                  {`{${key}}`}
                </button>
              ))}
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-slate-50/60">
            <button type="button" onClick={() => setOpenSystem(openSystem === kind ? null : kind)}
              className="flex w-full !min-h-0 items-center gap-2 px-4 py-2.5 text-left text-xs font-medium text-slate-600">
              <ChevronDown className={`h-4 w-4 transition-transform ${openSystem === kind ? 'rotate-180' : ''}`} />
              Added by the system on every call (how the AI saves the result)
            </button>
            {openSystem === kind && (
              <pre className="whitespace-pre-wrap border-t border-slate-200 px-4 py-3 font-mono text-[12px] leading-relaxed text-slate-600">
                {settings.script_system_parts?.[kind]}
              </pre>
            )}
          </div>
        </section>
      ))}

      <div className="flex justify-end">
        <Button variant="default" disabled={busy} onClick={() => void save()}>{busy ? 'Saving…' : 'Save call scripts'}</Button>
      </div>
    </div>
  )
}
